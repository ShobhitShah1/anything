import os
import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUTPUT_DIR = r"C:\AnyThing\store_screenshots"
os.makedirs(OUTPUT_DIR, exist_ok=True)

CANVAS_W = 1080
CANVAS_H = 1920

# Colors matching the Pebble reference
BG_TOP = (248, 250, 252)        # Crisp light slate
BG_BOTTOM = (235, 239, 245)     # Soft subtle studio tone
TEXT_BLACK = (17, 24, 39)       # #111827
TEXT_MUTED = (75, 85, 99)       # #4b5563
TEXT_DIM = (148, 163, 184)      # #94a3b8
ACCENT_GREEN = (22, 163, 74)    # #16a34a
NEON_GREEN = (74, 222, 128)     # #4ade80
INK_BLUE = (37, 99, 235)        # #2563eb

# Fonts
FONT_DIR = r"C:\Windows\Fonts"
FONT_HEAD_XL = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 86)
FONT_HEAD = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 68)
FONT_KICKER = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 26)
FONT_CARD_TITLE = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 34)
FONT_CARD_SUB = ImageFont.truetype(os.path.join(FONT_DIR, "segoeui.ttf"), 23)
FONT_CARD_DESC = ImageFont.truetype(os.path.join(FONT_DIR, "segoeui.ttf"), 21)
FONT_PILL = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 22)
FONT_BADGE = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 20)
FONT_HAND = ImageFont.truetype(os.path.join(FONT_DIR, "Inkfree.ttf"), 56)
FONT_HAND_SM = ImageFont.truetype(os.path.join(FONT_DIR, "Inkfree.ttf"), 44)

def create_base_canvas():
    """Generates a clean studio gradient background like the Pebble reference."""
    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), BG_TOP)
    draw = ImageDraw.Draw(canvas)
    for y in range(CANVAS_H):
        t = y / float(CANVAS_H)
        r = int(BG_TOP[0] * (1 - t) + BG_BOTTOM[0] * t)
        g = int(BG_TOP[1] * (1 - t) + BG_BOTTOM[1] * t)
        b = int(BG_TOP[2] * (1 - t) + BG_BOTTOM[2] * t)
        draw.line([(0, y), (CANVAS_W, y)], fill=(r, g, b, 255))
    return canvas

def add_drop_shadow(image, blur=28, offset=(0, 16), shadow_color=(0, 0, 0, 75)):
    """Creates a natural, soft Gaussian drop shadow for any RGBA image."""
    w, h = image.size
    pad = blur * 2
    sw, sh = w + pad * 2, h + pad * 2
    comp = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    
    alpha = image.split()[3]
    shadow = Image.new("RGBA", (w, h), shadow_color)
    shadow.putalpha(alpha)
    
    s_full = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    s_full.paste(shadow, (pad + offset[0], pad + offset[1]), shadow)
    s_blur = s_full.filter(ImageFilter.GaussianBlur(blur))
    
    comp.paste(s_blur, (0, 0))
    comp.paste(image, (pad, pad), image)
    return comp, pad

def create_photoreal_highlighter(target_w=150, target_h=400):
    """Renders a tactile, 3D chunky lime-green highlighter pen without any clipping or artifacts."""
    scale = 2
    cw = target_w * scale
    ch = target_h * scale
    cx = cw // 2
    
    img = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    
    # 1. Chisel Tip (y=30 to y=140)
    nib = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    nd = ImageDraw.Draw(nib)
    nib_pts = [(cx - 30, 35), (cx + 42, 70), (cx + 36, 140), (cx - 34, 140)]
    nd.polygon(nib_pts, fill=(163, 230, 53, 255)) # neon lime
    nib_facet = [(cx + 6, 52), (cx + 42, 70), (cx + 36, 140), (cx + 6, 140)]
    nd.polygon(nib_facet, fill=(101, 163, 13, 255))
    img = Image.alpha_composite(img, nib)
    
    # 2. Dark Collar (y=135 to y=225)
    collar = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    cd = ImageDraw.Draw(collar)
    collar_pts = [(cx - 44, 135), (cx + 46, 135), (cx + 56, 225), (cx - 52, 225)]
    cd.polygon(collar_pts, fill=(30, 41, 59, 255))
    img = Image.alpha_composite(img, collar)
    
    # 3. White Rubber Grip Ring (y=218 to y=305)
    grip = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grip)
    grip_box = [cx - 68, 218, cx + 68, 305]
    gd.rounded_rectangle(grip_box, radius=20, fill=(248, 250, 252, 255), outline=(203, 213, 225, 255), width=3)
    grip_sh = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    ImageDraw.Draw(grip_sh).rounded_rectangle([cx + 10, 218, cx + 68, 305], radius=20, fill=(148, 163, 184, 110))
    grip = Image.alpha_composite(grip, grip_sh)
    img = Image.alpha_composite(img, grip)
    
    # 4. Highlighter Body (y=298 to y=730)
    body_box = [cx - 74, 298, cx + 74, 730]
    body = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    bd = ImageDraw.Draw(body)
    bd.rounded_rectangle(body_box, radius=32, fill=(132, 204, 22, 255))
    
    shading = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shading)
    sd.rounded_rectangle([body_box[0]+4, body_box[1]+4, body_box[0]+42, body_box[3]-4], radius=16, fill=(255, 255, 255, 60))
    sd.rounded_rectangle([body_box[0]+14, body_box[1]+20, body_box[0]+26, body_box[3]-30], radius=6, fill=(255, 255, 255, 140))
    sd.rounded_rectangle([cx + 15, body_box[1]+4, body_box[2]-4, body_box[3]-4], radius=16, fill=(20, 83, 45, 90))
    
    body = Image.alpha_composite(body, shading)
    img = Image.alpha_composite(img, body)
    
    # 5. End Cap (y=715 to y=780)
    cap = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    ImageDraw.Draw(cap).rounded_rectangle([cx - 66, 715, cx + 66, 780], radius=22, fill=(101, 163, 13, 255))
    img = Image.alpha_composite(img, cap)
    
    res = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    return res

def draw_curved_arrow(draw, p0, p1, p2, color=INK_BLUE, width=4):
    """Draws a hand-drawn quadratic bezier curve with an arrow head."""
    points = []
    for i in range(25):
        t = i / 24.0
        x = (1 - t)**2 * p0[0] + 2 * (1 - t) * t * p1[0] + t**2 * p2[0]
        y = (1 - t)**2 * p0[1] + 2 * (1 - t) * t * p1[1] + t**2 * p2[1]
        points.append((x, y))
    draw.line(points, fill=color, width=width, joint="curve")
    
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    angle = math.atan2(dy, dx)
    arrow_len = 16
    a1 = angle + math.pi * 0.82
    a2 = angle - math.pi * 0.82
    draw.line([p2, (p2[0] + arrow_len * math.cos(a1), p2[1] + arrow_len * math.sin(a1))], fill=color, width=width)
    draw.line([p2, (p2[0] + arrow_len * math.cos(a2), p2[1] + arrow_len * math.sin(a2))], fill=color, width=width)

def draw_marker_loop(w=380, h=140, stroke_w=18, color=(74, 222, 128, 165)):
    """Draws a translucent neon highlighter oval loop."""
    scale = 2
    sw, sh = w * scale, h * scale
    pad = int(35 * scale)
    img = Image.new("RGBA", (sw + pad * 2, sh + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rect = [pad, pad, pad + sw, pad + sh]
    d.arc(rect, start=-15, end=350, fill=color, width=int(stroke_w * scale))
    res = img.resize((w + 70, h + 70), Image.Resampling.LANCZOS)
    return res

def create_phone_mockup(screen_path, target_w=640, target_h=1280):
    """Renders a sleek, modern smartphone mockup holding the real app screenshot."""
    scale = 2
    pw, ph = target_w * scale, target_h * scale
    frame = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    d = ImageDraw.Draw(frame)
    
    radius = int(52 * scale)
    bezel = int(12 * scale)
    
    # Outer dark titanium chassis
    d.rounded_rectangle([0, 0, pw, ph], radius=radius, fill=(24, 26, 31, 255), outline=(75, 85, 99, 255), width=int(2 * scale))
    
    # Inner screen
    sw = pw - bezel * 2
    sh = ph - bezel * 2
    
    screen_raw = Image.open(screen_path).convert("RGB")
    orig_w, orig_h = screen_raw.size
    crop_h = int(orig_w * (sh / float(sw)))
    screen_cropped = screen_raw.crop((0, 0, orig_w, min(crop_h, orig_h)))
    screen_resized = screen_cropped.resize((sw, sh), Image.Resampling.LANCZOS).convert("RGBA")
    
    # Rounded mask for screen
    s_mask = Image.new("L", (sw, sh), 0)
    sm_draw = ImageDraw.Draw(s_mask)
    sm_draw.rounded_rectangle([0, 0, sw, sh], radius=radius - bezel, fill=255)
    
    frame.paste(screen_resized, (bezel, bezel), s_mask)
    
    # Inner subtle rim outline
    d.rounded_rectangle([bezel, bezel, bezel + sw, bezel + sh], radius=radius - bezel, outline=(0, 0, 0, 80), width=int(1 * scale))
    
    # Punch hole camera pill
    pill_w = int(82 * scale)
    pill_h = int(22 * scale)
    pill_x = (pw - pill_w) // 2
    pill_y = bezel + int(10 * scale)
    d.rounded_rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + pill_h], radius=pill_h // 2, fill=(8, 9, 11, 255))
    
    # Camera lens reflection
    lens_x = pill_x + pill_w - int(16 * scale)
    lens_y = pill_y + pill_h // 2
    d.ellipse([lens_x - 4*scale, lens_y - 4*scale, lens_x + 4*scale, lens_y + 4*scale], fill=(30, 41, 59, 255))
    d.ellipse([lens_x - 2*scale, lens_y - 2*scale, lens_x + 1*scale, lens_y + 1*scale], fill=(96, 165, 250, 180))
    
    res = frame.resize((target_w, target_h), Image.Resampling.LANCZOS)
    return res

# =========================================================================
# SLIDE 1: Hero Showcase (NO Phone Attached)
# =========================================================================
def build_slide_1():
    print("Building Slide 1 (Hero Showcase)...")
    canvas = create_base_canvas()
    draw = ImageDraw.Draw(canvas)
    
    # Top Headline
    draw.text((540, 200), "Turn chaos\ninto clarity", fill=TEXT_BLACK, font=FONT_HEAD_XL, anchor="mm", align="center")
    
    # Step badge bubbles (1, 2, 3) on the left
    step_y = 420
    for num, alpha in [(1, 255), (2, 170), (3, 100)]:
        b_img = Image.new("RGBA", (54, 54), (0, 0, 0, 0))
        bd = ImageDraw.Draw(b_img)
        bd.ellipse([2, 2, 52, 52], fill=(30, 41, 59, alpha))
        bd.text((27, 27), str(num), fill=(255, 255, 255, alpha), font=FONT_BADGE, anchor="mm")
        canvas.paste(b_img, (160 + (num - 1) * 64, step_y), b_img)
        
    # Floating Real Card from App (FastImage GitHub card) tilted in background
    fast_raw = Image.open("device_captures/card_fastimage.png").convert("RGBA")
    fw = 440
    fh = int(fast_raw.height * (fw / float(fast_raw.width)))
    fast_resized = fast_raw.resize((fw, fh), Image.Resampling.LANCZOS)
    m1 = Image.new("L", (fw, fh), 0)
    ImageDraw.Draw(m1).rounded_rectangle([0, 0, fw, fh], radius=26, fill=255)
    fast_resized.putalpha(m1)
    fast_rot = fast_resized.rotate(-4, resample=Image.Resampling.BICUBIC, expand=True)
    fast_shadow, p1 = add_drop_shadow(fast_rot, blur=26, offset=(0, 14), shadow_color=(0, 0, 0, 60))
    canvas.paste(fast_shadow, (500 - p1, 480 - p1), fast_shadow)
    
    # Main Foreground Note Card
    card_w, card_h = 760, 390
    main_card = Image.new("RGBA", (card_w, card_h), (255, 255, 255, 255))
    mc_draw = ImageDraw.Draw(main_card)
    mc_draw.rounded_rectangle([0, 0, card_w, card_h], radius=34, outline=(226, 232, 240, 255), width=2)
    
    mc_draw.text((46, 42), "NOTE  ·  OCTOBER 25", fill=ACCENT_GREEN, font=FONT_KICKER)
    mc_draw.text((46, 92), "Save what matters", fill=TEXT_BLACK, font=FONT_CARD_TITLE)
    mc_draw.text((46, 148), "Links, articles, code snippets & visual ideas.", fill=TEXT_MUTED, font=FONT_CARD_SUB)
    mc_draw.text((46, 186), "Organized quietly in your sanctuary.", fill=TEXT_MUTED, font=FONT_CARD_SUB)
    
    # Tag pills
    tags = ["#design", "#inspiration", "#reading"]
    tx = 46
    for tag in tags:
        bbox = mc_draw.textbbox((0, 0), tag, font=FONT_PILL)
        tw = bbox[2] - bbox[0] + 32
        mc_draw.rounded_rectangle([tx, 280, tx + tw, 325], radius=12, fill=(241, 245, 249, 255))
        mc_draw.text((tx + 16, 302), tag, fill=(71, 85, 105), font=FONT_PILL, anchor="lm")
        tx += tw + 14
        
    # Category badge
    mc_draw.rounded_rectangle([card_w - 150, 38, card_w - 46, 82], radius=12, fill=(254, 243, 199, 255))
    mc_draw.text((card_w - 98, 60), "Sanctuary", fill=(180, 83, 9), font=FONT_BADGE, anchor="mm")
    
    main_shadow, pad2 = add_drop_shadow(main_card, blur=34, offset=(0, 20), shadow_color=(0, 0, 0, 85))
    card_x, card_y = 160, 780
    canvas.paste(main_shadow, (card_x - pad2, card_y - pad2), main_shadow)
    
    # Translucent Lime Highlighter Stroke drawn over "Save what matters"
    loop = draw_marker_loop(w=380, h=86, stroke_w=18, color=(74, 222, 128, 170))
    canvas.paste(loop, (card_x + 35, card_y + 64), loop)
    
    # 3D Highlighter Pen - Rotated +45 (counter-clockwise)
    pen = create_photoreal_highlighter(target_w=140, target_h=380)
    pen_rot = pen.rotate(45, resample=Image.Resampling.BICUBIC, expand=True)
    pen_shadow, pad_p = add_drop_shadow(pen_rot, blur=26, offset=(10, 18), shadow_color=(0, 0, 0, 95))
    canvas.paste(pen_shadow, (card_x + 400 - pad_p, card_y + 115 - pad_p), pen_shadow)
    
    # Blue handwritten "Saved!" with curved arrow
    draw.text((170, 1230), "Saved!", fill=INK_BLUE, font=FONT_HAND)
    draw_curved_arrow(draw, (330, 1260), (370, 1220), (350, 1180), color=INK_BLUE, width=4)
    
    # Bottom Status Floating Pill
    pill_w, pill_h = 760, 130
    pill_x = (CANVAS_W - pill_w) // 2
    pill_y = 1480
    pill_img = Image.new("RGBA", (pill_w, pill_h), (24, 26, 33, 255))
    p_draw = ImageDraw.Draw(pill_img)
    p_draw.rounded_rectangle([0, 0, pill_w, pill_h], radius=65, outline=(55, 65, 81, 255), width=2)
    
    p_draw.ellipse([34, 33, 96, 95], outline=(74, 222, 128, 255), width=6)
    p_draw.ellipse([55, 54, 75, 74], fill=(74, 222, 128, 255))
    
    p_draw.text((120, 48), "2,418 items saved", fill=(255, 255, 255, 255), font=FONT_CARD_TITLE)
    p_draw.text((120, 88), "0 Trackers  •  Zero Ads  •  100% Private", fill=TEXT_DIM, font=FONT_CARD_SUB)
    
    pill_shadow, pad_pill = add_drop_shadow(pill_img, blur=28, offset=(0, 16), shadow_color=(0, 0, 0, 110))
    canvas.paste(pill_shadow, (pill_x - pad_pill, pill_y - pad_pill), pill_shadow)
    
    out_png = os.path.join(OUTPUT_DIR, "01_hero_turn_chaos_into_clarity.png")
    out_jpg = os.path.join(OUTPUT_DIR, "01_hero_turn_chaos_into_clarity.jpg")
    canvas.convert("RGB").save(out_png, "PNG")
    canvas.convert("RGB").save(out_jpg, "JPEG", quality=95)
    print("Saved 01_hero_turn_chaos_into_clarity.png")

# =========================================================================
# SLIDE 2: Core Capture (With Phone Mockup)
# =========================================================================
def build_slide_2():
    print("Building Slide 2 (Capture Screen)...")
    canvas = create_base_canvas()
    draw = ImageDraw.Draw(canvas)
    
    # Top Kicker & Headline
    draw.text((540, 150), "CAPTURE", fill=ACCENT_GREEN, font=FONT_KICKER, anchor="mm")
    draw.text((540, 230), "Get your finds\nout fast", fill=TEXT_BLACK, font=FONT_HEAD, anchor="mm", align="center")
    
    # Centered Phone Mockup
    phone_w, phone_h = 640, 1280
    phone = create_phone_mockup("device_captures/s1_grid.png", target_w=phone_w, target_h=phone_h)
    phone_shadow, pad = add_drop_shadow(phone, blur=36, offset=(0, 22), shadow_color=(0, 0, 0, 80))
    phone_x = (CANVAS_W - phone_w) // 2
    phone_y = 350
    canvas.paste(phone_shadow, (phone_x - pad, phone_y - pad), phone_shadow)
    
    # Translucent highlighter loop drawn over a real card on the phone screen
    loop = draw_marker_loop(w=310, h=120, stroke_w=16, color=(74, 222, 128, 175))
    canvas.paste(loop, (phone_x + 40, phone_y + 400), loop)
    
    # 3D Highlighter pen - Rotated +45
    pen = create_photoreal_highlighter(target_w=135, target_h=370)
    pen_rot = pen.rotate(45, resample=Image.Resampling.BICUBIC, expand=True)
    pen_shadow, pad_p = add_drop_shadow(pen_rot, blur=24, offset=(8, 16), shadow_color=(0, 0, 0, 90))
    canvas.paste(pen_shadow, (phone_x + 280 - pad_p, phone_y + 460 - pad_p), pen_shadow)
    
    # Blue handwritten "instant!" with arrow placed cleanly on the left under the highlight
    draw.text((phone_x + 55, phone_y + 570), "instant!", fill=INK_BLUE, font=FONT_HAND)
    draw_curved_arrow(draw, (phone_x + 220, phone_y + 600), (phone_x + 270, phone_y + 560), (phone_x + 250, phone_y + 520), color=INK_BLUE, width=4)
    
    # Floating Pill at bottom
    pill_w, pill_h = 660, 78
    pill_x = (CANVAS_W - pill_w) // 2
    pill_y = 1680
    pill_img = Image.new("RGBA", (pill_w, pill_h), (255, 255, 255, 255))
    p_draw = ImageDraw.Draw(pill_img)
    p_draw.rounded_rectangle([0, 0, pill_w, pill_h], radius=39, outline=(226, 232, 240, 255), width=2)
    p_draw.ellipse([30, 29, 50, 49], fill=NEON_GREEN)
    p_draw.text((70, 39), "Auto-detects titles, rich previews & tags", fill=TEXT_BLACK, font=FONT_PILL, anchor="lm")
    
    pill_shadow, pad_pill = add_drop_shadow(pill_img, blur=24, offset=(0, 12), shadow_color=(0, 0, 0, 60))
    canvas.paste(pill_shadow, (pill_x - pad_pill, pill_y - pad_pill), pill_shadow)
    
    out_png = os.path.join(OUTPUT_DIR, "02_capture_save_fast.png")
    out_jpg = os.path.join(OUTPUT_DIR, "02_capture_save_fast.jpg")
    canvas.convert("RGB").save(out_png, "PNG")
    canvas.convert("RGB").save(out_jpg, "JPEG", quality=95)
    print("Saved 02_capture_save_fast.png")

# =========================================================================
# SLIDE 3: Layouts & Clarity (With Phone Mockup)
# =========================================================================
def build_slide_3():
    print("Building Slide 3 (List & Organization Screen)...")
    canvas = create_base_canvas()
    draw = ImageDraw.Draw(canvas)
    
    # Top Kicker & Headline
    draw.text((540, 150), "ORGANIZE", fill=ACCENT_GREEN, font=FONT_KICKER, anchor="mm")
    draw.text((540, 230), "Form follows focus.\nGrid or list in a tap.", fill=TEXT_BLACK, font=FONT_HEAD, anchor="mm", align="center")
    
    # Centered Phone Mockup with List screen
    phone_w, phone_h = 640, 1280
    phone = create_phone_mockup("device_captures/s2_list.png", target_w=phone_w, target_h=phone_h)
    phone_shadow, pad = add_drop_shadow(phone, blur=36, offset=(0, 22), shadow_color=(0, 0, 0, 80))
    phone_x = (CANVAS_W - phone_w) // 2
    phone_y = 350
    canvas.paste(phone_shadow, (phone_x - pad, phone_y - pad), phone_shadow)
    
    # 3D Pop-out Card in front of phone
    card_w, card_h = 580, 290
    card = Image.new("RGBA", (card_w, card_h), (255, 255, 255, 255))
    c_draw = ImageDraw.Draw(card)
    c_draw.rounded_rectangle([0, 0, card_w, card_h], radius=34, outline=(226, 232, 240, 255), width=2)
    
    c_draw.text((40, 36), "QUICK VIEW", fill=ACCENT_GREEN, font=FONT_KICKER)
    c_draw.text((40, 82), "Architecture of calm", fill=TEXT_BLACK, font=FONT_CARD_TITLE)
    c_draw.text((40, 132), "Design systems and calm digital spaces.", fill=TEXT_MUTED, font=FONT_CARD_SUB)
    c_draw.text((40, 168), "Saved to #design • 4 min read", fill=TEXT_DIM, font=FONT_CARD_DESC)
    
    # Action Button inside card with a crisp play triangle
    btn_box = [40, 215, 220, 260]
    c_draw.rounded_rectangle(btn_box, radius=14, fill=TEXT_BLACK)
    # Draw play triangle
    c_draw.polygon([(62, 230), (74, 237), (62, 244)], fill=(255, 255, 255, 255))
    c_draw.text((140, 237), "Open find", fill=(255, 255, 255, 255), font=FONT_PILL, anchor="mm")
    
    card_shadow, pad_c = add_drop_shadow(card, blur=34, offset=(0, 20), shadow_color=(0, 0, 0, 95))
    card_x = (CANVAS_W - card_w) // 2
    card_y = 900
    canvas.paste(card_shadow, (card_x - pad_c, card_y - pad_c), card_shadow)
    
    # Blue handwritten "clean!" with arrow
    draw.text((phone_x + 450, card_y + 160), "clean!", fill=INK_BLUE, font=FONT_HAND)
    draw_curved_arrow(draw, (phone_x + 460, card_y + 230), (phone_x + 410, card_y + 270), (phone_x + 370, card_y + 250), color=INK_BLUE, width=4)
    
    # Floating Bottom Pill
    pill_w, pill_h = 460, 74
    pill_x = (CANVAS_W - pill_w) // 2
    pill_y = 1680
    pill_img = Image.new("RGBA", (pill_w, pill_h), (255, 255, 255, 255))
    p_draw = ImageDraw.Draw(pill_img)
    p_draw.rounded_rectangle([0, 0, pill_w, pill_h], radius=37, outline=(226, 232, 240, 255), width=2)
    p_draw.text((pill_w // 2, pill_h // 2), "Grid View   •   Compact List", fill=TEXT_BLACK, font=FONT_PILL, anchor="mm")
    
    pill_shadow, pad_pill = add_drop_shadow(pill_img, blur=24, offset=(0, 12), shadow_color=(0, 0, 0, 60))
    canvas.paste(pill_shadow, (pill_x - pad_pill, pill_y - pad_pill), pill_shadow)
    
    out_png = os.path.join(OUTPUT_DIR, "03_visual_sanctuary.png")
    out_jpg = os.path.join(OUTPUT_DIR, "03_visual_sanctuary.jpg")
    canvas.convert("RGB").save(out_png, "PNG")
    canvas.convert("RGB").save(out_jpg, "JPEG", quality=95)
    print("Saved 03_visual_sanctuary.png")

# =========================================================================
# SLIDE 4: Intelligence Layer (AI Feature — With Phone Mockup)
# =========================================================================
def build_slide_4():
    print("Building Slide 4 (AI Assistant Screen)...")
    canvas = create_base_canvas()
    draw = ImageDraw.Draw(canvas)
    
    # Top Kicker & Headline
    draw.text((540, 150), "AI ASSISTANT", fill=ACCENT_GREEN, font=FONT_KICKER, anchor="mm")
    draw.text((540, 230), "Summarize, draft\n& expand with AI", fill=TEXT_BLACK, font=FONT_HEAD, anchor="mm", align="center")
    
    # Centered Phone Mockup with Anything Plus screen
    phone_w, phone_h = 640, 1280
    phone = create_phone_mockup("device_captures/s_plus.png", target_w=phone_w, target_h=phone_h)
    phone_shadow, pad = add_drop_shadow(phone, blur=36, offset=(0, 22), shadow_color=(0, 0, 0, 80))
    phone_x = (CANVAS_W - phone_w) // 2
    phone_y = 350
    canvas.paste(phone_shadow, (phone_x - pad, phone_y - pad), phone_shadow)
    
    # 3D Pop-out AI Summary Card in front of phone
    card_w, card_h = 600, 360
    card = Image.new("RGBA", (card_w, card_h), (255, 255, 255, 255))
    c_draw = ImageDraw.Draw(card)
    c_draw.rounded_rectangle([0, 0, card_w, card_h], radius=34, outline=(226, 232, 240, 255), width=2)
    
    # Sparkle tag with drawn star
    c_draw.rounded_rectangle([36, 32, 220, 72], radius=12, fill=(254, 243, 199, 255))
    # Draw 4-point sparkle star in gold
    sx, sy = 56, 52
    c_draw.polygon([(sx, sy-8), (sx+2, sy-2), (sx+8, sy), (sx+2, sy+2), (sx, sy+8), (sx-2, sy+2), (sx-8, sy), (sx-2, sy-2)], fill=(217, 119, 6))
    c_draw.text((140, 52), "QUICK ADD AI", fill=(180, 83, 9), font=FONT_KICKER, anchor="mm")
    
    c_draw.text((36, 95), "Executive Summary", fill=TEXT_BLACK, font=FONT_CARD_TITLE)
    
    points = [
        "• Core ideas extracted from article in seconds",
        "• Drafts writing ideas & expands thoughts",
        "• 100% private, zero prompt logging"
    ]
    py = 150
    for pt in points:
        c_draw.text((36, py), pt, fill=TEXT_MUTED, font=FONT_CARD_DESC)
        py += 36
        
    # Micro CTA button inside card
    c_draw.rounded_rectangle([36, 280, 230, 325], radius=14, fill=TEXT_BLACK)
    c_draw.text((133, 302), "+ Insert to Note", fill=(255, 255, 255, 255), font=FONT_PILL, anchor="mm")
    
    card_shadow, pad_c = add_drop_shadow(card, blur=36, offset=(0, 22), shadow_color=(0, 0, 0, 100))
    card_x = (CANVAS_W - card_w) // 2
    card_y = 860
    canvas.paste(card_shadow, (card_x - pad_c, card_y - pad_c), card_shadow)
    
    # Translucent highlighter stroke under first bullet
    hl_line = Image.new("RGBA", (460, 20), (0, 0, 0, 0))
    hl_draw = ImageDraw.Draw(hl_line)
    hl_draw.rounded_rectangle([0, 0, 460, 20], radius=6, fill=(74, 222, 128, 150))
    canvas.paste(hl_line, (card_x + 36, card_y + 162), hl_line)
    
    # Blue handwritten "smart!" with arrow
    draw.text((phone_x + 460, card_y + 220), "smart!", fill=INK_BLUE, font=FONT_HAND)
    draw_curved_arrow(draw, (phone_x + 480, card_y + 290), (phone_x + 420, card_y + 330), (phone_x + 380, card_y + 310), color=INK_BLUE, width=4)
    
    # Floating Bottom Pill
    pill_w, pill_h = 580, 74
    pill_x = (CANVAS_W - pill_w) // 2
    pill_y = 1680
    pill_img = Image.new("RGBA", (pill_w, pill_h), (255, 255, 255, 255))
    p_draw = ImageDraw.Draw(pill_img)
    p_draw.rounded_rectangle([0, 0, pill_w, pill_h], radius=37, outline=(226, 232, 240, 255), width=2)
    p_draw.text((pill_w // 2, pill_h // 2), "100 AI responses / mo   •   Private & Secure", fill=TEXT_BLACK, font=FONT_PILL, anchor="mm")
    
    pill_shadow, pad_pill = add_drop_shadow(pill_img, blur=24, offset=(0, 12), shadow_color=(0, 0, 0, 60))
    canvas.paste(pill_shadow, (pill_x - pad_pill, pill_y - pad_pill), pill_shadow)
    
    out_png = os.path.join(OUTPUT_DIR, "04_ai_assistant.png")
    out_jpg = os.path.join(OUTPUT_DIR, "04_ai_assistant.jpg")
    canvas.convert("RGB").save(out_png, "PNG")
    canvas.convert("RGB").save(out_jpg, "JPEG", quality=95)
    print("Saved 04_ai_assistant.png")

# =========================================================================
# SLIDE 5: Sovereignty & Privacy (Celebration / Trust — NO Phone Attached)
# =========================================================================
def build_slide_5():
    print("Building Slide 5 (Privacy & Sovereignty)...")
    canvas = create_base_canvas()
    draw = ImageDraw.Draw(canvas)
    
    # Festive Pastel Confetti floating in background
    random.seed(42)
    confetti_colors = [
        (74, 222, 128, 170),   # Mint
        (134, 239, 172, 170),  # Light green
        (251, 191, 36, 170),   # Warm yellow
        (147, 197, 253, 170),  # Soft sky blue
        (196, 181, 253, 170)   # Soft lavender
    ]
    for _ in range(70):
        cx = random.randint(40, CANVAS_W - 40)
        cy = random.randint(40, CANVAS_H - 180)
        cw = random.randint(10, 24)
        ch = random.randint(6, 16)
        ang = random.randint(0, 180)
        col = random.choice(confetti_colors)
        
        c_piece = Image.new("RGBA", (cw, ch), col)
        c_rot = c_piece.rotate(ang, expand=True)
        canvas.paste(c_rot, (cx, cy), c_rot)
        
    # Top Kicker & Headline
    draw.text((540, 170), "SOVEREIGNTY", fill=ACCENT_GREEN, font=FONT_KICKER, anchor="mm")
    draw.text((540, 260), "Your data.\nYours to keep.", fill=TEXT_BLACK, font=FONT_HEAD_XL, anchor="mm", align="center")
    
    # 3 Crisp Floating Feature Cards
    cards_data = [
        ("[01]  LOCAL-FIRST STORAGE", "100% Offline Capability",
         "The app functions immediately with zero account required.\nAll your saves live safely on your device storage.",
         ACCENT_GREEN),
        ("[02]  ZERO TRACKING OR ADS", "100% Private Sanctuary",
         "No trackers, zero telemetry, and no algorithmic feeds.\nYour collection is strictly yours and never monetized.",
         INK_BLUE),
        ("[03]  FULL PORTABILITY", "Open JSON Export & Import",
         "Export your entire library with a single tap at any time.\nZero proprietary lock-in. Move your data freely.",
         (217, 119, 6))
    ]
    
    card_w, card_h = 760, 210
    card_x = (CANVAS_W - card_w) // 2
    start_y = 420
    
    for i, (tag, title, desc, col) in enumerate(cards_data):
        cy = start_y + i * (card_h + 36)
        c_img = Image.new("RGBA", (card_w, card_h), (255, 255, 255, 255))
        cd = ImageDraw.Draw(c_img)
        cd.rounded_rectangle([0, 0, card_w, card_h], radius=28, outline=(226, 232, 240, 255), width=2)
        
        cd.text((44, 28), tag, fill=col, font=FONT_KICKER)
        cd.text((44, 68), title, fill=TEXT_BLACK, font=FONT_CARD_TITLE)
        
        dy = 120
        for line in desc.split("\n"):
            cd.text((44, dy), line, fill=TEXT_MUTED, font=FONT_CARD_DESC)
            dy += 28
            
        c_shadow, pad = add_drop_shadow(c_img, blur=28, offset=(0, 16), shadow_color=(0, 0, 0, 65))
        canvas.paste(c_shadow, (card_x - pad, cy - pad), c_shadow)
        
    # Big Bold Neon Green Checkmark across Card 2
    check_img = Image.new("RGBA", (280, 240), (0, 0, 0, 0))
    ck_draw = ImageDraw.Draw(check_img)
    ck_pts = [(40, 120), (105, 185), (240, 45)]
    ck_draw.line(ck_pts, fill=(74, 222, 128, 195), width=28, joint="curve")
    check_res = check_img.filter(ImageFilter.GaussianBlur(1))
    canvas.paste(check_res, (card_x + 480, start_y + card_h + 10), check_res)
    
    # 3D Highlighter pen - Rotated +45
    pen = create_photoreal_highlighter(target_w=140, target_h=380)
    pen_rot = pen.rotate(45, resample=Image.Resampling.BICUBIC, expand=True)
    pen_shadow, pad_p = add_drop_shadow(pen_rot, blur=26, offset=(10, 18), shadow_color=(0, 0, 0, 95))
    canvas.paste(pen_shadow, (card_x + 580 - pad_p, start_y + card_h + 40 - pad_p), pen_shadow)
    
    # Blue handwritten "Yours forever!" with arrow placed cleanly without overlapping letters
    draw.text((260, 1210), "Yours forever!", fill=INK_BLUE, font=FONT_HAND)
    draw_curved_arrow(draw, (560, 1250), (600, 1210), (580, 1160), color=INK_BLUE, width=4)
    
    # Bottom Brand Banner
    banner_w, banner_h = 760, 130
    banner_x = (CANVAS_W - banner_w) // 2
    banner_y = 1480
    banner_img = Image.new("RGBA", (banner_w, banner_h), (24, 26, 33, 255))
    b_draw = ImageDraw.Draw(banner_img)
    b_draw.rounded_rectangle([0, 0, banner_w, banner_h], radius=32, outline=(55, 65, 81, 255), width=2)
    
    b_draw.text((48, 42), "anything.", fill=(255, 255, 255, 255), font=FONT_CARD_TITLE)
    b_draw.text((48, 84), "Good finds, yours to keep.", fill=NEON_GREEN, font=FONT_CARD_SUB)
    
    # Download Pill
    btn_w, btn_h = 220, 56
    btn_x = banner_w - btn_w - 40
    btn_y = (banner_h - btn_h) // 2
    b_draw.rounded_rectangle([btn_x, btn_y, btn_x + btn_w, btn_y + btn_h], radius=28, fill=(255, 255, 255, 255))
    b_draw.text((btn_x + btn_w // 2, btn_y + btn_h // 2), "Download Free", fill=TEXT_BLACK, font=FONT_PILL, anchor="mm")
    
    banner_shadow, pad_b = add_drop_shadow(banner_img, blur=28, offset=(0, 16), shadow_color=(0, 0, 0, 110))
    canvas.paste(banner_shadow, (banner_x - pad_b, banner_y - pad_b), banner_shadow)
    
    out_png = os.path.join(OUTPUT_DIR, "05_privacy_ownership.png")
    out_jpg = os.path.join(OUTPUT_DIR, "05_privacy_ownership.jpg")
    canvas.convert("RGB").save(out_png, "PNG")
    canvas.convert("RGB").save(out_jpg, "JPEG", quality=95)
    print("Saved 05_privacy_ownership.png")

if __name__ == "__main__":
    print("=== Generating Pebble-Style Clean Play Store Screenshots ===")
    build_slide_1()
    build_slide_2()
    build_slide_3()
    build_slide_4()
    build_slide_5()
    print("=== All 5 Screenshots Built Successfully! ===")
