import os
import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUTPUT_DIR = "store_screenshots"
os.makedirs(OUTPUT_DIR, exist_ok=True)

CANVAS_W = 1080
CANVAS_H = 1920

# Palette - Deep Obsidian Luxury & Luminescent Accents
BG_DARK = (8, 9, 12)          # #08090c
BG_GRAD_END = (16, 18, 24)    # #101218
BORDER_DIM = (32, 36, 46)     # Hairline grid
BORDER_LIGHT = (55, 62, 78)

# Luminescent Accent Colors
COL_INDIGO = (129, 140, 248)  # #818cf8
COL_CYAN = (56, 189, 248)     # #38bdf8
COL_AMBER = (251, 191, 36)    # #fbbf24
COL_EMERALD = (52, 211, 153)  # #34d399
COL_VIOLET = (192, 132, 252)  # #c084fc

TEXT_WHITE = (250, 250, 252)
TEXT_MUTED = (148, 163, 184)
TEXT_DIM = (100, 116, 139)

# Fonts
FONT_DIR = r"C:\Windows\Fonts"
FONT_DISPLAY_BOLD = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 74)
FONT_DISPLAY_LIGHT = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuil.ttf"), 74)
FONT_SUBTITLE = ImageFont.truetype(os.path.join(FONT_DIR, "segoeui.ttf"), 30)
FONT_KICKER = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 22)
FONT_SPEC_LABEL = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 24)
FONT_SPEC_VAL = ImageFont.truetype(os.path.join(FONT_DIR, "segoeui.ttf"), 26)
FONT_CARD_TITLE = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 32)
FONT_CARD_DESC = ImageFont.truetype(os.path.join(FONT_DIR, "segoeui.ttf"), 23)
FONT_BADGE = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 22)

def create_editorial_canvas(index_str="01 / 05", category="OVERVIEW", glow_color=(45, 55, 95, 120), glow_pos=(540, 800)):
    """Creates a high-fashion, editorial canvas with film grain, architectural guidelines, and metadata stamps."""
    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), BG_DARK)
    draw = ImageDraw.Draw(canvas)
    
    # 1. Subtle vertical gradient
    for y in range(CANVAS_H):
        t = y / float(CANVAS_H)
        r = int(BG_DARK[0] * (1 - t) + BG_GRAD_END[0] * t)
        g = int(BG_DARK[1] * (1 - t) + BG_GRAD_END[1] * t)
        b = int(BG_DARK[2] * (1 - t) + BG_GRAD_END[2] * t)
        draw.line([(0, y), (CANVAS_W, y)], fill=(r, g, b))
        
    # 2. Ambient Light Caustic / Glow
    glow = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    gx, gy = glow_pos
    for rad in range(700, 60, -40):
        factor = (1.0 - rad / 700.0) ** 1.8
        alpha = int(glow_color[3] * factor)
        glow_draw.ellipse([gx - rad, gy - rad, gx + rad, gy + rad],
                          fill=(glow_color[0], glow_color[1], glow_color[2], alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    canvas.paste(glow, (0, 0), glow)
    
    # 3. Fine grain / tactile texture
    grain = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    # generate structured micro-noise on downscaled grid then upscale
    small_w, small_h = CANVAS_W // 4, CANVAS_H // 4
    noise_small = Image.effect_noise((small_w, small_h), 12).convert("RGBA")
    # tint noise slightly
    noise_up = noise_small.resize((CANVAS_W, CANVAS_H), Image.Resampling.BILINEAR)
    # blend noise at very subtle 4% opacity
    canvas = Image.blend(canvas, noise_up.convert("RGB"), 0.035)
    
    # Redraw context after blend
    draw = ImageDraw.Draw(canvas)
    
    # 4. Architectural Guide Lines & Corner Crosshairs (Swiss Typography Grid)
    # Margin guidelines at x=64 and x=1016
    draw.line([(64, 80), (64, 1840)], fill=BORDER_DIM, width=1)
    draw.line([(1016, 80), (1016, 1840)], fill=BORDER_DIM, width=1)
    draw.line([(64, 80), (1016, 80)], fill=BORDER_DIM, width=1)
    draw.line([(64, 1840), (1016, 1840)], fill=BORDER_DIM, width=1)
    
    # Subtle corner crosshairs
    def draw_crosshair(x, y):
        draw.line([(x - 8, y), (x + 8, y)], fill=BORDER_LIGHT, width=1)
        draw.line([(x, y - 8), (x, y + 8)], fill=BORDER_LIGHT, width=1)
        
    draw_crosshair(64, 80)
    draw_crosshair(1016, 80)
    draw_crosshair(64, 1840)
    draw_crosshair(1016, 1840)
    
    # 5. Top Architectural Metadata Bar
    meta_left = f"{index_str}   //   {category}"
    draw.text((90, 110), meta_left, fill=TEXT_DIM, font=FONT_KICKER)
    
    meta_right = "ANYTHING · MOBILE"
    bbox = draw.textbbox((0, 0), meta_right, font=FONT_KICKER)
    rw = bbox[2] - bbox[0]
    draw.text((1016 - rw - 26, 110), meta_right, fill=TEXT_DIM, font=FONT_KICKER)
    
    # Thin divider under meta bar
    draw.line([(90, 155), (1016 - 26, 155)], fill=BORDER_DIM, width=1)
    
    return canvas

def draw_editorial_title(canvas, line1_bold, line2_italic, subtitle, accent_col=COL_INDIGO, y_start=200):
    """Renders high-fashion editorial title with contrast weights."""
    draw = ImageDraw.Draw(canvas)
    
    # Line 1: Bold Display
    bbox1 = draw.textbbox((0, 0), line1_bold, font=FONT_DISPLAY_BOLD)
    w1 = bbox1[2] - bbox1[0]
    draw.text((90, y_start), line1_bold, fill=TEXT_WHITE, font=FONT_DISPLAY_BOLD)
    
    # Line 2: Expressive Light / Accent
    y_l2 = y_start + 86
    draw.text((90, y_l2), line2_italic, fill=accent_col, font=FONT_DISPLAY_LIGHT)
    
    # Subtitle
    y_sub = y_l2 + 96
    draw.text((90, y_sub), subtitle, fill=TEXT_MUTED, font=FONT_SUBTITLE)
    return y_sub + 55

def add_drop_shadow(image, radius=36, shadow_color=(0, 0, 0, 190), blur=30, offset=(0, 18)):
    """Creates a high-end multi-layer Gaussian drop shadow for any RGBA image."""
    w, h = image.size
    pad = blur * 2
    shadow_w = w + pad * 2
    shadow_h = h + pad * 2
    shadow_img = Image.new("RGBA", (shadow_w, shadow_h), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_img)
    
    s_draw.rounded_rectangle(
        [pad + offset[0], pad + offset[1], pad + offset[0] + w, pad + offset[1] + h],
        radius=radius,
        fill=shadow_color
    )
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(blur))
    
    # Composite original image over shadow
    comp = Image.new("RGBA", (shadow_w, shadow_h), (0, 0, 0, 0))
    comp.paste(shadow_img, (0, 0))
    comp.paste(image, (pad, pad), image)
    return comp, pad

def make_rounded_card(img, radius=32, border_color=(60, 68, 88), border_width=1):
    """Wraps an image into a card with smooth antialiased corners and rim lighting."""
    w, h = img.size
    # Create mask at 2x for ultra smooth antialiasing
    scale = 2
    mask2x = Image.new("L", (w * scale, h * scale), 0)
    m_draw = ImageDraw.Draw(mask2x)
    m_draw.rounded_rectangle([0, 0, w * scale, h * scale], radius=radius * scale, fill=255)
    mask = mask2x.resize((w, h), Image.Resampling.LANCZOS)
    
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    card.paste(img.convert("RGBA"), (0, 0), mask)
    
    # Draw subtle rim border
    c_draw = ImageDraw.Draw(card)
    c_draw.rounded_rectangle([0, 0, w, h], radius=radius, outline=border_color, width=border_width)
    return card

def draw_tilted_phone(canvas, screenshot_path, center_x, center_y, scale=0.72, angle=-3.5):
    """Renders a sleek, dynamically tilted smartphone mockup with realistic rim and shadow."""
    raw = Image.open(screenshot_path).convert("RGB")
    orig_w, orig_h = raw.size
    
    # Create device frame at 1:1
    phone_w = 760
    phone_h = 1560
    bezel = 14
    radius = 56
    
    frame = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 0))
    f_draw = ImageDraw.Draw(frame)
    # Titanium outer chassis
    f_draw.rounded_rectangle([0, 0, phone_w, phone_h], radius=radius, 
                            fill=(24, 26, 33, 255), outline=(65, 72, 90, 255), width=2)
    
    # Resample screenshot into screen
    screen_w = phone_w - (bezel * 2)
    screen_h = phone_h - (bezel * 2)
    crop_h = int(orig_w * (screen_h / float(screen_w)))
    screen_crop = raw.crop((0, 0, orig_w, min(crop_h, orig_h)))
    screen_resized = screen_crop.resize((screen_w, screen_h), Image.Resampling.LANCZOS).convert("RGBA")
    
    # Mask screen
    s_mask = Image.new("L", (screen_w, screen_h), 0)
    sm_draw = ImageDraw.Draw(s_mask)
    sm_draw.rounded_rectangle([0, 0, screen_w, screen_h], radius=radius - bezel, fill=255)
    
    frame.paste(screen_resized, (bezel, bezel), s_mask)
    f_draw.rounded_rectangle([bezel, bezel, bezel + screen_w, bezel + screen_h],
                            radius=radius - bezel, outline=(45, 50, 65, 120), width=1)
                            
    # Punch hole camera
    cam_x = phone_w // 2
    cam_y = bezel + 28
    f_draw.ellipse([cam_x - 9, cam_y - 9, cam_x + 9, cam_y + 9], fill=(10, 11, 14, 255), outline=(35, 38, 48, 255), width=1)
    f_draw.ellipse([cam_x - 3, cam_y - 3, cam_x - 1, cam_y - 1], fill=(70, 80, 115, 200))
    
    # Scale down
    new_w = int(phone_w * scale)
    new_h = int(phone_h * scale)
    phone_scaled = frame.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Rotate with smooth background
    phone_rotated = phone_scaled.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    
    # Multi-stage drop shadow
    shadow = Image.new("RGBA", phone_rotated.size, (0, 0, 0, 0))
    # Extract alpha from rotated phone to create perfect contour shadow
    sh_mask = phone_rotated.split()[3]
    shadow.paste((0, 0, 0, 195), (0, 0), sh_mask)
    shadow = shadow.filter(ImageFilter.GaussianBlur(32))
    
    rw, rh = phone_rotated.size
    px = center_x - rw // 2
    py = center_y - rh // 2
    
    # Paste shadow with downward offset
    canvas.paste(shadow, (px + 10, py + 24), shadow)
    canvas.paste(phone_rotated, (px, py), phone_rotated)

# =========================================================================
# SLIDE 1: "The Anti-Algorithm" (Curated Moodboard Mosaic - NO Phone Attached)
# =========================================================================
def build_creative_slide_1():
    print("Building Creative Slide 1...")
    canvas = create_editorial_canvas(index_str="01 / 05", category="SANCTUARY",
                                    glow_color=(65, 75, 125, 130), glow_pos=(540, 720))
    draw = ImageDraw.Draw(canvas)
    
    # Title
    draw_editorial_title(canvas,
                         line1_bold="Save what matters.",
                         line2_italic="Quietly. Beautifully.",
                         subtitle="A calm, personal sanctuary for links, ideas, and visual finds.",
                         accent_col=COL_INDIGO,
                         y_start=195)
                         
    # Central Visual: A floating, overlapping architectural moodboard of real cards!
    # Card A: Lloyd Creates artwork card
    art_raw = Image.open("device_captures/card_art.png")
    art_w = 400
    art_h = int(art_raw.height * (art_w / float(art_raw.width)))
    art_resized = art_raw.resize((art_w, art_h), Image.Resampling.LANCZOS)
    art_card = make_rounded_card(art_resized, radius=32, border_color=(75, 85, 115))
    
    # Card B: FastImage technical GitHub card
    code_raw = Image.open("device_captures/card_fastimage.png")
    code_w = 380
    code_h = int(code_raw.height * (code_w / float(code_raw.width)))
    code_resized = code_raw.resize((code_w, code_h), Image.Resampling.LANCZOS)
    code_card = make_rounded_card(code_resized, radius=28, border_color=(60, 68, 88))
    
    # Card C: Custom crafted editorial note card (Simulating a beautiful note)
    note_w, note_h = 420, 260
    note_img = Image.new("RGBA", (note_w, note_h), (22, 25, 34, 255))
    n_draw = ImageDraw.Draw(note_img)
    # Note header
    n_draw.text((32, 28), "NOTE  ·  OCTOBER 25", fill=COL_AMBER, font=FONT_KICKER)
    n_draw.text((32, 65), "Architecture of calm", fill=TEXT_WHITE, font=FONT_CARD_TITLE)
    note_body = "The best tools don't ask for your attention.\nThey give you your attention back.\nEverything in its right place."
    n_draw.text((32, 115), note_body, fill=TEXT_MUTED, font=FONT_CARD_DESC)
    # Bottom tag
    n_draw.rounded_rectangle([32, 205, 130, 235], radius=8, fill=(35, 40, 55))
    n_draw.text((44, 210), "#design", fill=COL_INDIGO, font=FONT_BADGE)
    note_card = make_rounded_card(note_img, radius=28, border_color=(65, 75, 95))
    
    # Composite Cards with overlapping depth and realistic angles
    # 1. Back Layer: FastImage Card tilted left (-4°)
    c_back = code_card.rotate(-4, resample=Image.Resampling.BICUBIC, expand=True)
    c_back_shadow, pad1 = add_drop_shadow(c_back, radius=28, shadow_color=(0,0,0,180), blur=28)
    canvas.paste(c_back_shadow, (90 - pad1, 720 - pad1), c_back_shadow)
    
    # 2. Middle Layer: Art Card tilted right (+3°)
    c_art = art_card.rotate(3.5, resample=Image.Resampling.BICUBIC, expand=True)
    c_art_shadow, pad2 = add_drop_shadow(c_art, radius=32, shadow_color=(0,0,0,210), blur=35)
    canvas.paste(c_art_shadow, (480 - pad2, 670 - pad2), c_art_shadow)
    
    # 3. Foreground Layer: Editorial Note Card (-2°)
    c_note = note_card.rotate(-2, resample=Image.Resampling.BICUBIC, expand=True)
    c_note_shadow, pad3 = add_drop_shadow(c_note, radius=28, shadow_color=(0,0,0,230), blur=32)
    canvas.paste(c_note_shadow, (140 - pad3, 1300 - pad3), c_note_shadow)
    
    # Floating feature chip badge on top right
    chip_w, chip_h = 320, 68
    chip_x, chip_y = 660, 1530
    draw.rounded_rectangle([chip_x, chip_y, chip_x + chip_w, chip_y + chip_h],
                           radius=34, fill=(24, 27, 36), outline=(65, 75, 100), width=1)
    draw.ellipse([chip_x + 18, chip_y + 26, chip_x + 34, chip_y + 42], fill=COL_EMERALD)
    draw.text((chip_x + 46, chip_y + 20), "Auto-detects content", fill=TEXT_WHITE, font=FONT_BADGE)
    
    # Bottom Technical Trust Footer
    draw.line([(90, 1690), (990, 1690)], fill=BORDER_DIM, width=1)
    
    specs = [
        ("01", "LOCAL FIRST", "Zero account needed"),
        ("02", "ZERO ADS", "No algorithmic feeds"),
        ("03", "100% PRIVATE", "Your collection is yours")
    ]
    col_w = (900) // 3
    for i, (num, label, desc) in enumerate(specs):
        bx = 90 + i * col_w
        draw.text((bx, 1715), f"[{num}]  {label}", fill=COL_INDIGO, font=FONT_KICKER)
        draw.text((bx, 1748), desc, fill=TEXT_MUTED, font=FONT_CARD_DESC)
        
    canvas.save(os.path.join(OUTPUT_DIR, "01_hero_showcase.png"), "PNG")
    print("Saved 01_hero_showcase.png")

# =========================================================================
# SLIDE 2: "The Infinite Stream" (Masonry Feed with 3D Breakout Card)
# =========================================================================
def build_creative_slide_2():
    print("Building Creative Slide 2...")
    canvas = create_editorial_canvas(index_str="02 / 05", category="FLUID GRID",
                                    glow_color=(45, 70, 110, 130), glow_pos=(420, 1050))
    draw = ImageDraw.Draw(canvas)
    
    draw_editorial_title(canvas,
                         line1_bold="Organized chaos,",
                         line2_italic="made calm.",
                         subtitle="Links, long reads, code, and images in a fluid visual gallery.",
                         accent_col=COL_CYAN,
                         y_start=195)
                         
    # Phone Mockup tilted slightly
    draw_tilted_phone(canvas, "device_captures/s1_grid.png", center_x=470, center_y=1220, scale=0.76, angle=-2.5)
    
    # 3D BREAKOUT CARD: A real card pops out of the phone into the foreground!
    # Card: Shobhit Shah profile / BuyMeACoffee card popping out with vivid accent
    shobhit_raw = Image.open("device_captures/card_shobhit.png")
    pop_w = 460
    pop_h = int(shobhit_raw.height * (pop_w / float(shobhit_raw.width)))
    pop_resized = shobhit_raw.resize((pop_w, pop_h), Image.Resampling.LANCZOS)
    pop_card = make_rounded_card(pop_resized, radius=28, border_color=COL_CYAN, border_width=2)
    
    # Tilt slightly opposite (+3.5°) to create strong parallax / 3D depth
    pop_rot = pop_card.rotate(4.0, resample=Image.Resampling.BICUBIC, expand=True)
    pop_shadow, pad = add_drop_shadow(pop_rot, radius=28, shadow_color=(0, 0, 0, 240), blur=40, offset=(10, 25))
    
    canvas.paste(pop_shadow, (530 - pad, 1050 - pad), pop_shadow)
    
    # Editorial pointer badge
    callout_x, callout_y = 660, 940
    callout_w, callout_h = 290, 64
    draw.rounded_rectangle([callout_x, callout_y, callout_x + callout_w, callout_y + callout_h],
                           radius=32, fill=(20, 24, 34), outline=COL_CYAN, width=1)
    draw.text((callout_x + 28, callout_y + 18), "⚡ Instant Link Preview", fill=TEXT_WHITE, font=FONT_BADGE)
    
    # Thin connecting line from callout to card
    draw.line([(callout_x + 140, callout_y + callout_h), (callout_x + 100, callout_y + callout_h + 40)], fill=COL_CYAN, width=1)
    
    canvas.save(os.path.join(OUTPUT_DIR, "02_masonry_gallery.png"), "PNG")
    print("Saved 02_masonry_gallery.png")

# =========================================================================
# SLIDE 3: "Dual Perspective" (Staggered Overlapping Layouts: Grid & List)
# =========================================================================
def build_creative_slide_3():
    print("Building Creative Slide 3...")
    canvas = create_editorial_canvas(index_str="03 / 05", category="PERSPECTIVES",
                                    glow_color=(35, 80, 95, 120), glow_pos=(540, 1050))
    draw = ImageDraw.Draw(canvas)
    
    draw_editorial_title(canvas,
                         line1_bold="Form follows focus.",
                         line2_italic="Grid or list in a tap.",
                         subtitle="Switch effortlessly between high-density rows and visual cards.",
                         accent_col=COL_CYAN,
                         y_start=195)
                         
    # Background Mockup: Grid view (tilted -4° on the left)
    draw_tilted_phone(canvas, "device_captures/s1_grid.png", center_x=340, center_y=1240, scale=0.70, angle=-4.0)
    
    # Foreground Mockup: List view (standing crisp on the right, overlapping!)
    draw_tilted_phone(canvas, "device_captures/s2_list.png", center_x=680, center_y=1200, scale=0.74, angle=2.5)
    
    # Floating layout switch pill in between
    pill_w, pill_h = 360, 68
    pill_x = (CANVAS_W - pill_w) // 2
    pill_y = 1680
    draw.rounded_rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + pill_h],
                           radius=34, fill=(18, 22, 30), outline=BORDER_LIGHT, width=1)
    draw.text((pill_x + 36, pill_y + 20), "Grid View   ⇄   Compact List", fill=COL_CYAN, font=FONT_BADGE)
    
    canvas.save(os.path.join(OUTPUT_DIR, "03_clean_list_views.png"), "PNG")
    print("Saved 03_clean_list_views.png")

# =========================================================================
# SLIDE 4: "The Intelligence Layer" (AI Writing Assistant with Floating Synthesis)
# =========================================================================
def build_creative_slide_4():
    print("Building Creative Slide 4...")
    canvas = create_editorial_canvas(index_str="04 / 05", category="INTELLIGENCE",
                                    glow_color=(90, 60, 120, 130), glow_pos=(540, 1050))
    draw = ImageDraw.Draw(canvas)
    
    draw_editorial_title(canvas,
                         line1_bold="From a spark",
                         line2_italic="to a complete draft.",
                         subtitle="Generate drafts, summarize articles, and refine thoughts with built-in AI.",
                         accent_col=COL_AMBER,
                         y_start=195)
                         
    # Phone displaying Anything Plus screen
    draw_tilted_phone(canvas, "device_captures/s_plus.png", center_x=450, center_y=1220, scale=0.76, angle=-2.0)
    
    # 3D FLOATING AI SYNTHESIS CARD: Shows live AI capabilities in front of the phone!
    ai_w, ai_h = 520, 310
    ai_img = Image.new("RGBA", (ai_w, ai_h), (20, 22, 32, 255))
    a_draw = ImageDraw.Draw(ai_img)
    
    # Glowing top gradient line
    for x in range(ai_w):
        t = x / float(ai_w)
        r = int(COL_AMBER[0] * (1 - t) + COL_VIOLET[0] * t)
        g = int(COL_AMBER[1] * (1 - t) + COL_VIOLET[1] * t)
        b = int(COL_AMBER[2] * (1 - t) + COL_VIOLET[2] * t)
        a_draw.line([(x, 0), (x, 3)], fill=(r, g, b, 255))
        
    a_draw.text((36, 26), "✨  QUICK ADD AI", fill=COL_AMBER, font=FONT_KICKER)
    a_draw.text((36, 68), "Executive Summary", fill=TEXT_WHITE, font=FONT_CARD_TITLE)
    
    ai_points = [
        "• Core thesis: calm interfaces reduce cognitive fatigue",
        "• Background sync resolves without disrupting writing",
        "• Action item: publish private Firestore security rules"
    ]
    py = 118
    for pt in ai_points:
        a_draw.text((36, py), pt, fill=TEXT_MUTED, font=FONT_CARD_DESC)
        py += 36
        
    # Micro CTA button inside AI card
    a_draw.rounded_rectangle([36, 240, 200, 280], radius=10, fill=(35, 40, 58))
    a_draw.text((54, 248), "+ Insert Draft", fill=TEXT_WHITE, font=FONT_BADGE)
    
    ai_card = make_rounded_card(ai_img, radius=28, border_color=(85, 95, 130), border_width=1)
    
    # Rotate slightly and add deep dimensional shadow
    ai_rot = ai_card.rotate(3.5, resample=Image.Resampling.BICUBIC, expand=True)
    ai_shadow, pad = add_drop_shadow(ai_rot, radius=28, shadow_color=(0, 0, 0, 240), blur=40, offset=(12, 28))
    
    canvas.paste(ai_shadow, (500 - pad, 1100 - pad), ai_shadow)
    
    # Bottom badge
    b_badge = "100 AI responses / mo  •  Private usage  •  No prompt logging"
    bbox = draw.textbbox((0, 0), b_badge, font=FONT_KICKER)
    bw = bbox[2] - bbox[0] + 48
    bx = (CANVAS_W - bw) // 2
    by = 1730
    draw.rounded_rectangle([bx, by, bx + bw, by + 50], radius=25, fill=(22, 25, 36), outline=BORDER_DIM, width=1)
    draw.text(((CANVAS_W - (bbox[2] - bbox[0])) // 2, by + 12), b_badge, fill=TEXT_MUTED, font=FONT_KICKER)
    
    canvas.save(os.path.join(OUTPUT_DIR, "04_ai_assistant.png"), "PNG")
    print("Saved 04_ai_assistant.png")

# =========================================================================
# SLIDE 5: "The Manifesto" (Architectural Trust Matrix - NO Phone Attached)
# =========================================================================
def build_creative_slide_5():
    print("Building Creative Slide 5...")
    canvas = create_editorial_canvas(index_str="05 / 05", category="SOVEREIGNTY",
                                    glow_color=(45, 90, 75, 130), glow_pos=(540, 750))
    draw = ImageDraw.Draw(canvas)
    
    draw_editorial_title(canvas,
                         line1_bold="Your data.",
                         line2_italic="Not their product.",
                         subtitle="No trackers. No algorithmic feeds. Complete data sovereignty.",
                         accent_col=COL_EMERALD,
                         y_start=195)
                         
    # Dieter Rams / Teenage Engineering Architectural Spec Sheet Matrix
    # 4 Sleek Technical Cards
    cards = [
        ("01", "LOCAL-FIRST CORE", 
         "100% Offline Capability",
         "The app functions immediately with no account creation. Your saves live in local storage on your device. Uninstalling removes all local records cleanly.",
         COL_EMERALD),
        ("02", "PRIVATE CLOUD SYNC", 
         "Zero Tracking / Cloud Isolation",
         "Sign in with Google only if you choose to sync across devices. Data is stored strictly under private user paths with Firestore security rule validation.",
         COL_CYAN),
        ("03", "FULL PORTABILITY", 
         "Open JSON Export / Import",
         "Export your entire library with one tap. Zero lock-in and zero proprietary databases. Move your saves freely whenever you want.",
         COL_AMBER),
        ("04", "NATIVE PERFORMANCE", 
         "Pure Native Rendering",
         "No slow WebViews or memory leaks. Built with React Native, FastImage disk/memory caching, and Reanimated for instant response times.",
         COL_INDIGO)
    ]
    
    card_w = 900
    card_h = 240
    card_x = (CANVAS_W - card_w) // 2
    card_y = 520
    
    for num, tag, title, desc, col in cards:
        # Sleek dark container
        draw.rounded_rectangle([card_x, card_y, card_x + card_w, card_y + card_h],
                               radius=24, fill=(18, 22, 30), outline=(38, 44, 58), width=1)
                               
        # Left technical index stamp
        draw.text((card_x + 40, card_y + 36), f"// {num}", fill=col, font=FONT_KICKER)
        draw.text((card_x + 120, card_y + 36), tag, fill=TEXT_DIM, font=FONT_KICKER)
        
        # Main Title
        draw.text((card_x + 40, card_y + 75), title, fill=TEXT_WHITE, font=FONT_CARD_TITLE)
        
        # Description
        words = desc.split(" ")
        lines = []
        cur = []
        for w in words:
            test = " ".join(cur + [w])
            bbox = draw.textbbox((0, 0), test, font=FONT_CARD_DESC)
            if bbox[2] - bbox[0] > (card_w - 90):
                lines.append(" ".join(cur))
                cur = [w]
            else:
                cur.append(w)
        if cur:
            lines.append(" ".join(cur))
            
        desc_y = card_y + 125
        for line in lines:
            draw.text((card_x + 40, desc_y), line, fill=TEXT_MUTED, font=FONT_CARD_DESC)
            desc_y += 34
            
        card_y += card_h + 24
        
    # Closing Brand Identity Block
    cta_w = 900
    cta_h = 135
    cta_x = (CANVAS_W - cta_w) // 2
    cta_y = card_y + 20
    draw.rounded_rectangle([cta_x, cta_y, cta_x + cta_w, cta_y + cta_h],
                           radius=26, fill=(24, 28, 38), outline=(55, 65, 85), width=1)
                           
    cta_title = "anything."
    draw.text((cta_x + 48, cta_y + 28), cta_title, fill=TEXT_WHITE, font=FONT_CARD_TITLE)
    cta_sub = "Good finds. Yours to keep."
    draw.text((cta_x + 48, cta_y + 74), cta_sub, fill=COL_EMERALD, font=FONT_SUBTITLE)
    
    # CTA Pill
    badge = "Download Free"
    bbox = draw.textbbox((0, 0), badge, font=FONT_SPEC_LABEL)
    bw = bbox[2] - bbox[0] + 50
    bx = cta_x + cta_w - bw - 40
    by = cta_y + (cta_h - 56) // 2
    draw.rounded_rectangle([bx, by, bx + bw, by + 56], radius=28, fill=TEXT_WHITE)
    draw.text((bx + 25, by + 12), badge, fill=(15, 17, 23), font=FONT_SPEC_LABEL)
    
    canvas.save(os.path.join(OUTPUT_DIR, "05_privacy_portability.png"), "PNG")
    print("Saved 05_privacy_portability.png")

if __name__ == "__main__":
    print("=== Generating High-End Editorial Screenshots ===")
    build_creative_slide_1()
    build_creative_slide_2()
    build_creative_slide_3()
    build_creative_slide_4()
    build_creative_slide_5()
    print("=== Complete! ===")
