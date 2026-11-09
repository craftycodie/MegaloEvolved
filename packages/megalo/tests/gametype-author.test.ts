import { bitstream, search_for_chunk } from "@blamnetwork/blf";
import {
  c_game_engine_custom_variant,
  s_blf_chunk_content_header,
} from "@blamnetwork/blf/haloreach_mcc/v_untracked_25_08_16_1352";
import { compileSource } from "src/compile-source";
import { MEGALO_VERSIONS } from "src/version";
import { describe, expect, it } from "vitest";

const { c_bitstream_reader, e_bitstream_byte_order } = bitstream;

const version = MEGALO_VERSIONS["107-mcc"];

const minimalScript = `string_table english
\tname "Custom Game"
end
engine_data
\tname name
end
`;

describe("gametype author metadata", () => {
  it("defaults author to MegaloEvolved in mpvr chdr and variant", async () => {
    const result = await compileSource(minimalScript, {
      version,
      fileType: "mpvr",
    });
    expect(result.bytes).toBeDefined();
    const bytes = result.bytes!;

    const chdr = new s_blf_chunk_content_header();
    expect(search_for_chunk(bytes, chdr, "big")).toBe(true);
    expect(chdr.metadata.creation_history.name).toBe("MegaloEvolved");
    expect(chdr.metadata.modification_history.name).toBe("MegaloEvolved");
  });

  it("falls back to MegaloEvolved when creatorGamertag is empty", async () => {
    const result = await compileSource(minimalScript, {
      version,
      fileType: "mpvr",
      compilerSettings: { creatorGamertag: "" },
    });
    expect(result.bytes).toBeDefined();
    const chdr = new s_blf_chunk_content_header();
    expect(search_for_chunk(result.bytes!, chdr, "big")).toBe(true);
    expect(chdr.metadata.creation_history.name).toBe("MegaloEvolved");
  });

  it("uses creatorGamertag from compiler settings", async () => {
    const result = await compileSource(minimalScript, {
      version,
      fileType: "mpvr",
      compilerSettings: { creatorGamertag: "TestAuthor" },
    });
    expect(result.bytes).toBeDefined();
    const bytes = result.bytes!;

    const chdr = new s_blf_chunk_content_header();
    expect(search_for_chunk(bytes, chdr, "big")).toBe(true);
    expect(chdr.metadata.creation_history.name).toBe("TestAuthor");
    expect(chdr.metadata.modification_history.name).toBe("TestAuthor");

    // Also check mglo-encoded metadata inside the variant bitstream path.
    const mglo = await compileSource(minimalScript, {
      version,
      fileType: "mglo",
      compilerSettings: { creatorGamertag: "TestAuthor" },
    });
    expect(mglo.bytes).toBeDefined();
    const reader = c_bitstream_reader.new(
      mglo.bytes!,
      e_bitstream_byte_order._bitstream_byte_order_big_endian
    );
    reader.begin_reading();
    const custom = new c_game_engine_custom_variant();
    custom.decode(reader);
    reader.finish_reading();
    expect(custom.m_base_variant.m_metadata.creation_history.name).toBe(
      "TestAuthor"
    );
    expect(custom.m_base_variant.m_metadata.modification_history.name).toBe(
      "TestAuthor"
    );
  });
});
