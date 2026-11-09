import { bitstream } from "@blamnetwork/blf";
import { e_action_type } from "@blamnetwork/blf/haloreach_mcc/v_untracked_25_08_16_1352";
import { describe, expect, it } from "vitest";
import { compileSource } from "../src/compile-source";
import { decodeMglo } from "../src/decode-mglo";
import { DiagnosticSeverity } from "../src/diagnostics";
import { MEGALO_VERSIONS } from "../src/version";

const { c_bitstream_writer, e_bitstream_byte_order } = bitstream;

/**
 * MCC-only actions. BLF has encoders and decoders for each, so a compiled
 * variant must decode and re-encode to the same bytes. A mismatch means BLF's
 * encode and decode disagree for one of these actions.
 */
const SOURCE = `string_table english
\tname "Custom Game"
end
engine_data
\tname name
end
variables player
\tlocal number hold 0
end
trigger local
\taction for_each player
\taction hs_function_call second_function
\taction get_button_time current_player jump current_player.hold
\taction team_set_vehicle_spawning current_team true
\taction player_set_vehicle_spawning current_player false
\taction set_player_respawn_vehicle "warthog" current_player
\taction set_team_respawn_vehicle "warthog" current_team
\taction hide_object current_player true
end
`;

const MCC_ACTIONS = [
  e_action_type.hs_function_call,
  e_action_type.get_button_time,
  e_action_type.team_set_vehicle_spawning,
  e_action_type.player_set_vehicle_spawning,
  e_action_type.set_player_respawn_vehicle,
  e_action_type.set_team_respawn_vehicle,
  e_action_type.hide_object,
];

const encode = (variant: { encode(writer: unknown): void }): Uint8Array => {
  const writer = c_bitstream_writer.new(
    0,
    e_bitstream_byte_order._bitstream_byte_order_big_endian
  );
  writer.begin_writing();
  variant.encode(writer);
  writer.finish_writing();
  return writer.get_data();
};

describe("MCC-only actions", () => {
  it("decode and re-encode to the compiled bytes", async () => {
    const result = await compileSource(SOURCE, {
      version: MEGALO_VERSIONS["107-mcc"],
      objectLists: {
        objects: ["warthog"],
        strings: ["first_function", "second_function"],
      },
    });
    const errors = result.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Error
    );
    expect(errors.map((d) => d.message)).toEqual([]);
    expect(result.bytes).toBeTruthy();
    const bytes = result.bytes as Uint8Array;

    const { gametype } = decodeMglo(bytes);
    const variant = gametype as unknown as {
      encode(writer: unknown): void;
      m_game_engine: {
        m_actions: {
          m_type: number;
          m_hs_function_call_parameters?: { m_function_name_index: number };
        }[];
      };
    };
    const types = variant.m_game_engine.m_actions.map((a) => a.m_type);
    for (const type of MCC_ACTIONS) {
      expect(types, e_action_type[type]).toContain(type);
    }

    // Index of `second_function` in the strings list (BLF adds 1 on the wire).
    const hsCall = variant.m_game_engine.m_actions.find(
      (a) => a.m_type === e_action_type.hs_function_call
    );
    expect(hsCall?.m_hs_function_call_parameters?.m_function_name_index).toBe(
      1
    );

    expect(Buffer.from(encode(variant)).toString("hex")).toBe(
      Buffer.from(bytes).toString("hex")
    );
  });
});
