import {
  DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE,
  SEQUENCE_CUSTOM_COLOR_SHADES,
} from "../colors";
import {
  getShadesForColor,
  isCustomColor,
} from "../components/ColorPicker/colorPickerUtils";

describe("colorPickerUtils", () => {
  it("keeps the sequence accent fill custom while providing shades", () => {
    expect(
      getShadesForColor({
        color: "#eef3ff",
        palette: DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE,
      }),
    ).toEqual({
      colorName: null,
      shade: 1,
      shades: SEQUENCE_CUSTOM_COLOR_SHADES,
    });
    expect(
      isCustomColor({
        color: "#eef3ff",
        palette: DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE,
      }),
    ).toBe(true);
  });
});
