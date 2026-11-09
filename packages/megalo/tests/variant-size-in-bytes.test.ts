import { bitstream } from "@blamnetwork/blf";
import { c_game_engine_custom_variant } from "@blamnetwork/blf/haloreach_mcc/v_untracked_25_08_16_1352";
import { describe, expect, it } from "vitest";
import { compileSource } from "../src/compile-source";
import { MEGALO_VERSIONS } from "../src/version";

// MCC's own game variants (game_variants/*_054.bin) and MegaloEdit's output
// record size_in_bytes = 21289: _blf 48 + chdr 704 + mpvr 20520 + _eof 17.
const MPVR_FILE_SIZE = 21_289;

const { c_bitstream_reader, e_bitstream_byte_order } = bitstream;

const decodeMglo = (bytes: Uint8Array) => {
  const reader = c_bitstream_reader.new(
    bytes,
    e_bitstream_byte_order._bitstream_byte_order_big_endian
  );
  reader.begin_reading();
  const custom = new c_game_engine_custom_variant();
  custom.decode(reader);
  reader.finish_reading();
  return custom;
};

describe("metadata size_in_bytes", () => {
  it("is the mpvr file size in an MCC .mglo, as MegaloEdit writes it", async () => {
    const result = await compileSource("", {
      version: MEGALO_VERSIONS["107-mcc"],
    });
    expect(result.bytes).toBeDefined();
    const general = decodeMglo(result.bytes!).m_base_variant.m_metadata.general;
    expect(general.size_in_bytes).toBe(MPVR_FILE_SIZE);
  });

  it.each(
    Object.keys(MEGALO_VERSIONS) as (keyof typeof MEGALO_VERSIONS)[]
  )("matches the mpvr file length for %s", async (id) => {
    const result = await compileSource("", {
      version: MEGALO_VERSIONS[id],
      fileType: "mpvr",
    });
    expect(result.bytes?.length).toBe(MPVR_FILE_SIZE);
  });
});
