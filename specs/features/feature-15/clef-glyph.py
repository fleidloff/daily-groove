#!/usr/bin/env python3
"""
Where ScaleStaff.tsx's CLEF_PATH comes from, and how to reproduce it.

The clef is the G clef (SMuFL U+E050) of **Bravura**, Steinberg's reference
engraving font — © Steinberg Media Technologies GmbH, SIL Open Font License 1.1,
https://github.com/steinbergmedia/bravura. The app ships the glyph's outline as
path coordinates, not the font: nothing is downloaded at runtime, no face is
loaded, and the drawing cannot change under us when a font does.

Feature-11 drew the clef by hand and said why an outline was the wrong choice —
"offsetting a hand-placed spine to fake [a thick-thin axis] is what makes a clef
look scribbled". That is true of an axis placed by hand. Feature-15 first
replaced it with an outline generated from a centreline and a width profile,
which fixed the axis and still read as a stylised clef rather than a normal one.
This is the third and last answer: the shape a musician actually expects, taken
from the font that defines it.

    python3 -m venv .venv && .venv/bin/pip install fonttools
    curl -O https://raw.githubusercontent.com/steinbergmedia/bravura/master/redist/otf/Bravura.otf
    .venv/bin/python clef-glyph.py > path.txt
"""

from fontTools.misc.transform import Transform
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

G_CLEF = 0xE050

# SMuFL puts one staff space at 0.25 em — 250 units in Bravura's 1000-unit em —
# and sets a clef's origin on the line it designates. For a G clef that is the
# second line up, which in the drawing's own box is y=112 with a space of 16.
SPACE_IN_FONT = 250.0
SPACE_IN_BOX = 16.0
G_LINE_IN_BOX = 112.0


def clef_path(font_path: str) -> str:
    font = TTFont(font_path)
    glyphs = font.getGlyphSet()
    glyph = glyphs[font.getBestCmap()[G_CLEF]]

    k = SPACE_IN_BOX / SPACE_IN_FONT
    # y is negated: font coordinates grow upwards, SVG's grow down. No x offset —
    # placing the clef on the staff is CLEF_PLACEMENT's job in the component, and
    # it should stay the only thing that moves the artwork.
    pen = SVGPathPen(glyphs, ntos=lambda v: f'{v:.2f}')
    glyph.draw(TransformPen(pen, Transform(k, 0, 0, -k, 0, G_LINE_IN_BOX)))
    return pen.getCommands()


if __name__ == '__main__':
    print(clef_path('Bravura.otf'))
