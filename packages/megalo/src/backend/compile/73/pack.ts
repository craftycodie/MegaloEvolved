import { bitstream, write_blffile } from "@blamnetwork/blf";
import {
  c_game_engine_custom_variant,
  c_game_variant,
  e_game_mode,
  s_blf_chunk_game_variant,
  s_blf_chunk_matchmaking_game_variant,
} from "@blamnetwork/blf/haloreach/v09730_10_04_09_1309_omaha_delta";
import {
  s_blf_chunk_content_header,
  s_blf_chunk_end_of_file,
  s_blf_chunk_start_of_file,
  type s_content_item_history,
} from "@blamnetwork/blf/haloreach/v12065_11_08_24_1738_tu1actual";
import type { CompiledMegaloFileType } from "src/backend/compile/compiler";

/** `chdr.build_number` is a u16; -1 ("no build") is written as 0xffff. */
const NO_BUILD_NUMBER = 0xff_ff;

const { c_bitstream_reader, c_bitstream_writer, e_bitstream_byte_order } =
  bitstream;

const encodeCustomVariantBitstream = (
  custom: c_game_engine_custom_variant
): Uint8Array => {
  const writer = c_bitstream_writer.new(
    0,
    e_bitstream_byte_order._bitstream_byte_order_big_endian
  );
  writer.begin_writing();
  custom.encode(writer);
  writer.finish_writing();
  return writer.get_data();
};

const wrapGameVariant = (
  custom: c_game_engine_custom_variant
): c_game_variant => {
  const gameVariant = new c_game_variant();
  gameVariant.m_game_engine = e_game_mode.megalogamengine;
  gameVariant.m_custom_variant = custom;
  return gameVariant;
};

const copyHistory = (
  source: s_content_item_history
): s_content_item_history => ({
  timestamp: source.timestamp,
  xuid: source.xuid,
  name: source.name,
  is_online: source.is_online,
});

const buildContentHeader = (
  custom: c_game_engine_custom_variant,
  sizeInBytes: number
): s_blf_chunk_content_header => {
  const source = custom.m_base_variant.m_metadata;
  const chdr = new s_blf_chunk_content_header();
  // Unset build (-1) is stored as 0xffff, as MCC's own game variants do.
  chdr.build_number =
    custom.m_build_number >= 0 ? custom.m_build_number : NO_BUILD_NUMBER;
  chdr.build_sequence_number = 0;

  chdr.metadata.general = { ...source.general, size_in_bytes: sizeInBytes };
  chdr.metadata.display = { ...source.display };
  chdr.metadata.creation_history = copyHistory(source.creation_history);
  chdr.metadata.modification_history = copyHistory(source.modification_history);
  chdr.metadata.name = source.name;
  chdr.metadata.description = source.description;
  const fileTypeData = source.file_type_data;
  chdr.metadata.file_type_data =
    fileTypeData !== null && "icon_index" in fileTypeData
      ? { icon_index: fileTypeData.icon_index }
      : fileTypeData;
  chdr.metadata.activity_data = source.activity_data;
  chdr.metadata.game_mode_data = source.game_mode_data;
  return chdr;
};

export const packCompiledVariant = (
  custom: c_game_engine_custom_variant,
  fileType: CompiledMegaloFileType
): { data: Uint8Array; variantByteLength: number } => {
  custom.m_encoding_version = 73;

  const gameVariant = wrapGameVariant(custom);
  const writeMpvr = (sizeInBytes: number): Uint8Array =>
    write_blffile("big", [
      s_blf_chunk_start_of_file.create("game variant"),
      buildContentHeader(custom, sizeInBytes),
      s_blf_chunk_game_variant.create(gameVariant),
      new s_blf_chunk_end_of_file(),
    ]);

  // A game variant records the byte size of its mpvr file, in the content
  // header and in its own metadata, whatever file type it is saved as. The
  // mpvr chunk has a fixed size, so one trial pack gives the size.
  const sizeInBytes = writeMpvr(0).length;
  custom.m_base_variant.m_metadata.general.size_in_bytes = sizeInBytes;

  const mglo = encodeCustomVariantBitstream(custom);
  if (fileType === "mglo") {
    return { data: mglo, variantByteLength: mglo.length };
  }

  if (fileType === "gvar") {
    return {
      data: write_blffile("big", [
        s_blf_chunk_start_of_file.create("game variant"),
        s_blf_chunk_matchmaking_game_variant.create(gameVariant),
        new s_blf_chunk_end_of_file(),
      ]),
      variantByteLength: mglo.length,
    };
  }

  return { data: writeMpvr(sizeInBytes), variantByteLength: mglo.length };
};

export const packMgloBytes = (
  mgloBytes: Uint8Array,
  fileType: Exclude<CompiledMegaloFileType, "mglo">
): Uint8Array => {
  const reader = c_bitstream_reader.new(
    mgloBytes,
    e_bitstream_byte_order._bitstream_byte_order_big_endian
  );
  reader.begin_reading();
  const custom = new c_game_engine_custom_variant();
  custom.decode(reader);
  reader.finish_reading();
  return packCompiledVariant(custom, fileType).data;
};
