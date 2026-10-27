import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUTPUT_DIR = "store_screenshots"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Canvas Dimensions (1080 x 1920) - 16:9 Standard, fully compliant with Google Play Console (< 2:1 ratio)
CANVAS_W = 1080
CANVAS_H = 1920

# Colors
BG_TOP = (11, 13, 17)        # #0b0d11
BG_BOTTOM = (18, 21, 28)     # #12151c
ACCENT_INDIGO = (129, 140, 248) # #818cf8
ACCENT_CYAN = (56, 189, 248)    # #38bdf8
ACCENT_EMERALD = (52, 211, 153) # #34d399
ACCENT_AMBER = (251, 191, 36)   # #fbbf24
ACCENT_ROSE = (244, 63, 94)     # #f43f5e
TEXT_WHITE = (248, 250, 252)    # #f8fafc
TEXT_MUTED = (156, 163, 175)    # #9ca3af
BORDER_COLOR = (42, 46, 58)     # #2a2e3a
CARD_BG = (21, 24, 33)          # #151821

# Fonts
FONT_DIR = r"C:\Windows\Fonts"
FONT_HERO = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 68)
FONT_HEADING = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 54)
FONT_EYEBROW = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 22)
FONT_SUBTITLE = ImageFont.truetype(os.path.join(FONT_DIR, "segoeui.ttf"), 30)
FONT_CARD_TITLE = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 32)
FONT_CARD_DESC = ImageFont.truetype(os.path.join(FONT_DIR, "segoeui.ttf"), 24)
FONT_TAG = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 26)
FONT_CODE = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 28)

def create_base_canvas(glow_center=(540, 960), glow_radius=650, glow_rgba=(40, 50, 80, 100)):
    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), BG_TOP)
    draw = ImageDraw.Draw(canvas)
    
    # Smooth vertical gradient
    for y in range(CANVAS_H):
        t = y / float(CANVAS_H)
        r = int(BG_TOP[0] * (1 - t) + BG_BOTTOM[0] * t)
        g = int(BG_TOP[1] * (1 - t) + BG_BOTTOM[1] * t)
        b = int(BG_TOP[2] * (1 - t) + BG_BOTTOM[2] * t)
        draw.line([(0, y), (CANVAS_W, y)], fill=(r, g, b))
        
    # Ambient radial glow
    glow = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    gx, gy = glow_center
    for rad in range(glow_radius, 40, -35):
        alpha = int(glow_rgba[3] * (1.0 - rad / float(glow_radius)))
        glow_draw.ellipse([gx - rad, gy - rad, gx + rad, gy + rad], 
                          fill=(glow_rgba[0], glow_rgba[1], glow_rgba[2], alpha))
                          
    glow = glow.filter(ImageFilter.GaussianBlur(55))
    canvas.paste(glow, (0, 0), glow)
    return canvas

def draw_header(canvas, eyebrow, title, subtitle, accent_color=ACCENT_INDIGO, y_start=140):
    draw = ImageDraw.Draw(canvas)
    
    # Eyebrow
    spaced_eyebrow = "  ".join(list(eyebrow.upper()))
    bbox = draw.textbbox((0, 0), spaced_eyebrow, font=FONT_EYEBROW)
    w = bbox[2] - bbox[0]
    draw.text(((CANVAS_W - w) // 2, y_start), spaced_eyebrow, fill=accent_color, font=FONT_EYEBROW)
    
    # Title
    y_title = y_start + 45
    bbox = draw.textbbox((0, 0), title, font=FONT_HEADING)
    w = bbox[2] - bbox[0]
    draw.text(((CANVAS_W - w) // 2, y_title), title, fill=TEXT_WHITE, font=FONT_HEADING)
    
    # Subtitle
    y_sub = y_title + 72
    bbox = draw.textbbox((0, 0), subtitle, font=FONT_SUBTITLE)
    w = bbox[2] - bbox[0]
    draw.text(((CANVAS_W - w) // 2, y_sub), subtitle, fill=TEXT_MUTED, font=FONT_SUBTITLE)
    return y_sub + 50

def draw_phone_mockup(canvas, screenshot_path, center_x=540, center_y=1160, screen_w=730):
    raw_img = Image.open(screenshot_path).convert("RGB")
    orig_w, orig_h = raw_img.size
    
    screen_h = 1380
    bezel = 14
    frame_w = screen_w + (bezel * 2)
    frame_h = screen_h + (bezel * 2)
    radius = 54
    
    top_x = center_x - frame_w // 2
    top_y = center_y - frame_h // 2
    
    # Multi-layered soft drop shadow
    shadow_pad = 70
    shadow_img = Image.new("RGBA", (frame_w + shadow_pad * 2, frame_h + shadow_pad * 2), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_img)
    s_draw.rounded_rectangle(
        [shadow_pad, shadow_pad + 20, shadow_pad + frame_w, shadow_pad + 20 + frame_h],
        radius=radius,
        fill=(0, 0, 0, 190)
    )
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(35))
    canvas.paste(shadow_img, (top_x - shadow_pad, top_y - shadow_pad), shadow_img)
    
    # Titanium frame
    frame = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    f_draw = ImageDraw.Draw(frame)
    f_draw.rounded_rectangle([0, 0, frame_w, frame_h], radius=radius, 
                            fill=(26, 28, 35, 255), outline=(55, 60, 75, 255), width=2)
    
    # Resample screenshot
    crop_h = int(orig_w * (screen_h / float(screen_w)))
    if crop_h > orig_h:
        crop_h = orig_h
    screen_crop = raw_img.crop((0, 0, orig_w, crop_h))
    screen_resized = screen_crop.resize((screen_w, screen_h), Image.Resampling.LANCZOS).convert("RGBA")
    
    # Rounded mask for display
    mask = Image.new("L", (screen_w, screen_h), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.rounded_rectangle([0, 0, screen_w, screen_h], radius=radius - bezel, fill=255)
    
    frame.paste(screen_resized, (bezel, bezel), mask)
    f_draw.rounded_rectangle([bezel, bezel, bezel + screen_w, bezel + screen_h], 
                            radius=radius - bezel, outline=(45, 48, 60, 100), width=1)
    
    # Top punch-hole camera
    cam_x = frame_w // 2
    cam_y = bezel + 28
    f_draw.ellipse([cam_x - 9, cam_y - 9, cam_x + 9, cam_y + 9], fill=(12, 13, 16, 255), outline=(32, 35, 45, 255), width=1)
    f_draw.ellipse([cam_x - 3, cam_y - 3, cam_x - 1, cam_y - 1], fill=(70, 80, 110, 200))
    
    # Bottom home bar
    bar_w = 170
    bar_x = (frame_w - bar_w) // 2
    bar_y = frame_h - bezel - 16
    f_draw.rounded_rectangle([bar_x, bar_y, bar_x + bar_w, bar_y + 5], radius=3, fill=(200, 205, 220, 160))
    
    canvas.paste(frame, (top_x, top_y), frame)

# -------------------------------------------------------------
# Vector Icon Drawing Helpers (Clean, sharp, no missing fonts)
# -------------------------------------------------------------
def draw_icon_badge(draw, cx, cy, size=64, bg_color=(28, 33, 46), border_color=(50, 60, 80)):
    hs = size // 2
    draw.ellipse([cx - hs, cy - hs, cx + hs, cy + hs], fill=bg_color, outline=border_color, width=1)

def draw_icon_link(draw, cx, cy, color=ACCENT_INDIGO):
    # Two connected chain links
    draw.rounded_rectangle([cx - 20, cy - 8, cx - 2, cy + 8], radius=4, outline=color, width=4)
    draw.rounded_rectangle([cx + 2, cy - 8, cx + 20, cy + 8], radius=4, outline=color, width=4)
    draw.line([(cx - 6, cy), (cx + 6, cy)], fill=color, width=4)

def draw_icon_note(draw, cx, cy, color=ACCENT_CYAN):
    # Note page with lines
    draw.rounded_rectangle([cx - 14, cy - 18, cx + 14, cy + 18], radius=4, outline=color, width=3)
    draw.line([(cx - 8, cy - 8), (cx + 8, cy - 8)], fill=color, width=3)
    draw.line([(cx - 8, cy), (cx + 8, cy)], fill=color, width=3)
    draw.line([(cx - 8, cy + 8), (cx + 4, cy + 8)], fill=color, width=3)

def draw_icon_code(draw, cx, cy, color=ACCENT_AMBER):
    # < / > symbol
    text = "</>"
    bbox = draw.textbbox((0, 0), text, font=FONT_CODE)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    draw.text((cx - w // 2, cy - h // 2 - 2), text, fill=color, font=FONT_CODE)

def draw_icon_photo(draw, cx, cy, color=ACCENT_ROSE):
    # Image frame with mountain & sun
    draw.rounded_rectangle([cx - 18, cy - 14, cx + 18, cy + 14], radius=4, outline=color, width=3)
    # Sun dot
    draw.ellipse([cx - 10, cy - 8, cx - 6, cy - 4], fill=color)
    # Mountain peaks
    draw.line([(cx - 14, cy + 10), (cx - 5, cy), (cx + 4, cy + 10)], fill=color, width=3)
    draw.line([(cx + 2, cy + 10), (cx + 9, cy + 3), (cx + 15, cy + 10)], fill=color, width=3)

def draw_icon_checklist(draw, cx, cy, color=ACCENT_EMERALD):
    # Rounded checklist box with checkmark
    draw.rounded_rectangle([cx - 16, cy - 16, cx + 16, cy + 16], radius=6, outline=color, width=3)
    # Checkmark inside
    draw.line([(cx - 9, cy), (cx - 3, cy + 7)], fill=color, width=3)
    draw.line([(cx - 3, cy + 7), (cx + 9, cy - 6)], fill=color, width=3)

def draw_icon_lock(draw, cx, cy, color=ACCENT_EMERALD):
    # Shackle
    draw.arc([cx - 18, cy - 26, cx + 18, cy + 4], start=180, end=0, fill=color, width=5)
    # Body
    draw.rounded_rectangle([cx - 22, cy - 6, cx + 22, cy + 24], radius=6, fill=color)
    # Keyhole
    draw.ellipse([cx - 4, cy + 3, cx + 4, cy + 10], fill=(21, 24, 33))
    draw.line([(cx, cy + 9), (cx, cy + 17)], fill=(21, 24, 33), width=3)

def draw_icon_cloud(draw, cx, cy, color=ACCENT_CYAN):
    # 3 cloud puffs
    draw.ellipse([cx - 22, cy - 2, cx - 4, cy + 16], fill=color)
    draw.ellipse([cx - 12, cy - 18, cx + 12, cy + 6], fill=color)
    draw.ellipse([cx + 4, cy - 4, cx + 22, cy + 16], fill=color)
    draw.rounded_rectangle([cx - 18, cy + 4, cx + 18, cy + 16], radius=4, fill=color)

def draw_icon_box(draw, cx, cy, color=ACCENT_AMBER):
    # Cube / package
    draw.rounded_rectangle([cx - 18, cy - 18, cx + 18, cy + 18], radius=6, outline=color, width=4)
    # Top flap lines
    draw.line([(cx - 18, cy - 4), (cx + 18, cy - 4)], fill=color, width=3)
    draw.line([(cx, cy - 4), (cx, cy + 18)], fill=color, width=3)

def draw_icon_bolt(draw, cx, cy, color=ACCENT_INDIGO):
    # Lightning bolt polygon
    pts = [
        (cx + 2, cy - 22),
        (cx - 16, cy + 2),
        (cx - 2, cy + 2),
        (cx - 6, cy + 22),
        (cx + 16, cy - 2),
        (cx + 2, cy - 2)
    ]
    draw.polygon(pts, fill=color)

# -------------------------------------------------------------
# SLIDE 1: Hero Showcase (NO attached device screenshot)
# -------------------------------------------------------------
def build_slide_1():
    canvas = create_base_canvas(glow_center=(540, 700), glow_radius=750, glow_rgba=(55, 65, 110, 130))
    draw = ImageDraw.Draw(canvas)
    
    # App Icon with rounded corners and glowing rim
    icon_raw = Image.open("mobile/assets/icon-ios-dark.png").convert("RGBA")
    icon_size = 210
    icon_resized = icon_raw.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    
    icon_mask = Image.new("L", (icon_size, icon_size), 0)
    im_draw = ImageDraw.Draw(icon_mask)
    im_draw.rounded_rectangle([0, 0, icon_size, icon_size], radius=48, fill=255)
    
    icon_top_x = (CANVAS_W - icon_size) // 2
    icon_top_y = 170
    
    # Icon shadow
    i_shadow = Image.new("RGBA", (icon_size + 80, icon_size + 80), (0, 0, 0, 0))
    is_draw = ImageDraw.Draw(i_shadow)
    is_draw.rounded_rectangle([40, 48, 40 + icon_size, 48 + icon_size], radius=48, fill=(0, 0, 0, 200))
    i_shadow = i_shadow.filter(ImageFilter.GaussianBlur(25))
    canvas.paste(i_shadow, (icon_top_x - 40, icon_top_y - 40), i_shadow)
    
    # Paste Icon
    canvas.paste(icon_resized, (icon_top_x, icon_top_y), icon_mask)
    draw.rounded_rectangle([icon_top_x, icon_top_y, icon_top_x + icon_size, icon_top_y + icon_size], 
                           radius=48, outline=(70, 80, 105), width=2)
                           
    # Brand Name
    y_brand = icon_top_y + icon_size + 35
    b_text = "anything."
    bbox = draw.textbbox((0, 0), b_text, font=FONT_HERO)
    draw.text(((CANVAS_W - (bbox[2] - bbox[0])) // 2, y_brand), b_text, fill=TEXT_WHITE, font=FONT_HERO)
    
    # Tagline
    y_tag = y_brand + 82
    t_text = "Good finds. Yours to keep."
    bbox = draw.textbbox((0, 0), t_text, font=FONT_CARD_TITLE)
    draw.text(((CANVAS_W - (bbox[2] - bbox[0])) // 2, y_tag), t_text, fill=ACCENT_INDIGO, font=FONT_CARD_TITLE)
    
    # Subtitle
    y_sub = y_tag + 52
    s_text = "A calm personal collection for everything you want to save."
    bbox = draw.textbbox((0, 0), s_text, font=FONT_SUBTITLE)
    draw.text(((CANVAS_W - (bbox[2] - bbox[0])) // 2, y_sub), s_text, fill=TEXT_MUTED, font=FONT_SUBTITLE)
    
    # 5 Floating Content Pill Cards
    items = [
        ("link", "Bookmarks & Web Links", "Rich titles, social previews & instant background metadata", ACCENT_INDIGO),
        ("note", "Notes & Thoughts", "Capture quick ideas with progressive native voice-to-text", ACCENT_CYAN),
        ("code", "Markdown & Code Snippets", "Native formatting, tables, task lists & syntax highlighted code", ACCENT_AMBER),
        ("photo", "Photos & Visual Inspiration", "Uncropped display with high-speed memory & disk caching", ACCENT_ROSE),
        ("check", "Checklists & To-Dos", "Clear action items without distracting feeds or clutter", ACCENT_EMERALD)
    ]
    
    card_y = y_sub + 85
    card_w = 900
    card_h = 125
    card_x = (CANVAS_W - card_w) // 2
    
    for kind, title, desc, col in items:
        # Card background
        draw.rounded_rectangle([card_x, card_y, card_x + card_w, card_y + card_h], 
                               radius=26, fill=(18, 21, 29), outline=(38, 43, 56), width=1)
        
        # Badge circle
        bx = card_x + 52
        by = card_y + (card_h // 2)
        draw_icon_badge(draw, bx, by, size=64, bg_color=(25, 30, 42), border_color=(45, 55, 75))
        
        # Draw vector icon
        if kind == "link":
            draw_icon_link(draw, bx, by, col)
        elif kind == "note":
            draw_icon_note(draw, bx, by, col)
        elif kind == "code":
            draw_icon_code(draw, bx, by, col)
        elif kind == "photo":
            draw_icon_photo(draw, bx, by, col)
        elif kind == "check":
            draw_icon_checklist(draw, bx, by, col)
            
        # Title
        draw.text((card_x + 115, card_y + 26), title, fill=TEXT_WHITE, font=FONT_CARD_TITLE)
        # Description
        draw.text((card_x + 115, card_y + 70), desc, fill=TEXT_MUTED, font=FONT_CARD_DESC)
        
        card_y += card_h + 20
        
    # Bottom Badge
    b_pill = "100% Offline Ready  •  Zero Ads  •  Private by Design"
    bbox = draw.textbbox((0, 0), b_pill, font=FONT_EYEBROW)
    pw = bbox[2] - bbox[0] + 56
    ph = 56
    px = (CANVAS_W - pw) // 2
    py = 1750
    draw.rounded_rectangle([px, py, px + pw, py + ph], radius=28, fill=(24, 28, 38), outline=(50, 56, 75), width=1)
    draw.text(((CANVAS_W - (bbox[2] - bbox[0])) // 2, py + 15), b_pill, fill=TEXT_MUTED, font=FONT_EYEBROW)
    
    canvas.save(os.path.join(OUTPUT_DIR, "01_hero_showcase.png"), "PNG")
    print("Slide 1 generated: 01_hero_showcase.png")

# -------------------------------------------------------------
# SLIDE 2: Masonry Feed (Main App Screen)
# -------------------------------------------------------------
def build_slide_2():
    canvas = create_base_canvas(glow_center=(540, 1100), glow_radius=680, glow_rgba=(45, 55, 90, 110))
    draw_header(canvas, 
                eyebrow="MASONRY FEED", 
                title="All your finds, in one calm place", 
                subtitle="Browse web links, notes, images, and code in a fluid visual grid",
                accent_color=ACCENT_INDIGO)
    draw_phone_mockup(canvas, "device_captures/s1_grid.png", center_x=540, center_y=1170, screen_w=730)
    canvas.save(os.path.join(OUTPUT_DIR, "02_masonry_gallery.png"), "PNG")
    print("Slide 2 generated: 02_masonry_gallery.png")

# -------------------------------------------------------------
# SLIDE 3: Focused List View (Alternative Clean Layout)
# -------------------------------------------------------------
def build_slide_3():
    canvas = create_base_canvas(glow_center=(540, 1100), glow_radius=680, glow_rgba=(35, 65, 85, 110))
    draw_header(canvas, 
                eyebrow="FOCUSED VIEWS", 
                title="Multiple layouts. Zero clutter.", 
                subtitle="Switch effortlessly between dynamic grid, list, and focus views",
                accent_color=ACCENT_CYAN)
    draw_phone_mockup(canvas, "device_captures/s2_list.png", center_x=540, center_y=1170, screen_w=730)
    canvas.save(os.path.join(OUTPUT_DIR, "03_clean_list_views.png"), "PNG")
    print("Slide 3 generated: 03_clean_list_views.png")

# -------------------------------------------------------------
# SLIDE 4: AI Companion (Anything Plus AI Screen)
# -------------------------------------------------------------
def build_slide_4():
    canvas = create_base_canvas(glow_center=(540, 1100), glow_radius=680, glow_rgba=(70, 50, 95, 110))
    draw_header(canvas, 
                eyebrow="AI ASSISTANT", 
                title="Make more of every idea", 
                subtitle="Draft thoughts, generate summaries, and refine notes with built-in AI",
                accent_color=ACCENT_AMBER)
    draw_phone_mockup(canvas, "device_captures/s_plus.png", center_x=540, center_y=1170, screen_w=730)
    canvas.save(os.path.join(OUTPUT_DIR, "04_ai_assistant.png"), "PNG")
    print("Slide 4 generated: 04_ai_assistant.png")

# -------------------------------------------------------------
# SLIDE 5: Privacy & Control (NO attached device screenshot)
# -------------------------------------------------------------
def build_slide_5():
    canvas = create_base_canvas(glow_center=(540, 850), glow_radius=750, glow_rgba=(35, 75, 65, 120))
    draw = ImageDraw.Draw(canvas)
    
    draw_header(canvas, 
                eyebrow="PRIVACY & CONTROL", 
                title="Your collection. Truly yours.", 
                subtitle="Built from the ground up for privacy, speed, and complete peace of mind",
                accent_color=ACCENT_EMERALD,
                y_start=140)
                
    # 4 Large Benefit Cards
    cards = [
        ("lock", "100% Local-First & Offline", 
         "Start saving immediately with zero sign-up friction. Your entire collection lives safely on your device with no mandatory cloud account.",
         ACCENT_EMERALD),
        ("cloud", "Private Cloud Sync", 
         "Connect with Google only when you want to sync across devices. Powered by private Firestore rules with zero shared tracking.",
         ACCENT_CYAN),
        ("box", "Full Data Portability", 
         "One-click JSON export and import anytime. Your data belongs to you—move your saves freely with zero proprietary lock-in.",
         ACCENT_AMBER),
        ("bolt", "Native & Battery Friendly", 
         "Engineered with pure native components, FastImage caching, and Reanimated. No heavy WebViews, background trackers, or clutter.",
         ACCENT_INDIGO)
    ]
    
    card_w = 900
    card_h = 230
    card_x = (CANVAS_W - card_w) // 2
    card_y = 440
    
    for kind, title, desc, col in cards:
        # Card Box
        draw.rounded_rectangle([card_x, card_y, card_x + card_w, card_y + card_h], 
                               radius=28, fill=(18, 22, 29), outline=(40, 48, 62), width=1)
        
        # Icon circle
        ic_size = 72
        ic_x = card_x + 56
        ic_y = card_y + 56
        draw_icon_badge(draw, ic_x, ic_y, size=ic_size, bg_color=(26, 32, 44), border_color=(50, 60, 78))
        
        if kind == "lock":
            draw_icon_lock(draw, ic_x, ic_y, col)
        elif kind == "cloud":
            draw_icon_cloud(draw, ic_x, ic_y, col)
        elif kind == "box":
            draw_icon_box(draw, ic_x, ic_y, col)
        elif kind == "bolt":
            draw_icon_bolt(draw, ic_x, ic_y, col)
            
        # Title
        draw.text((card_x + 125, card_y + 36), title, fill=TEXT_WHITE, font=FONT_CARD_TITLE)
        
        # Description (Word wrapped)
        words = desc.split(" ")
        lines = []
        cur = []
        for w in words:
            test = " ".join(cur + [w])
            bbox = draw.textbbox((0, 0), test, font=FONT_CARD_DESC)
            if bbox[2] - bbox[0] > (card_w - 160):
                lines.append(" ".join(cur))
                cur = [w]
            else:
                cur.append(w)
        if cur:
            lines.append(" ".join(cur))
            
        desc_y = card_y + 92
        for line in lines:
            draw.text((card_x + 125, desc_y), line, fill=TEXT_MUTED, font=FONT_CARD_DESC)
            desc_y += 36
            
        card_y += card_h + 30
        
    # Closing CTA banner
    cta_w = 900
    cta_h = 140
    cta_x = (CANVAS_W - cta_w) // 2
    cta_y = card_y + 30
    draw.rounded_rectangle([cta_x, cta_y, cta_x + cta_w, cta_y + cta_h], 
                           radius=28, fill=(24, 28, 38), outline=(55, 65, 85), width=1)
    
    cta_title = "Anything."
    bbox = draw.textbbox((0, 0), cta_title, font=FONT_CARD_TITLE)
    draw.text((cta_x + 45, cta_y + 30), cta_title, fill=TEXT_WHITE, font=FONT_CARD_TITLE)
    
    cta_sub = "Good finds. Yours to keep."
    draw.text((cta_x + 45, cta_y + 76), cta_sub, fill=ACCENT_EMERALD, font=FONT_SUBTITLE)
    
    badge = "Get Started Free"
    bbox = draw.textbbox((0, 0), badge, font=FONT_TAG)
    bw = bbox[2] - bbox[0] + 50
    bx = cta_x + cta_w - bw - 40
    by = cta_y + (cta_h - 56) // 2
    draw.rounded_rectangle([bx, by, bx + bw, by + 56], radius=28, fill=TEXT_WHITE)
    draw.text((bx + 25, by + 12), badge, fill=(15, 17, 23), font=FONT_TAG)
    
    canvas.save(os.path.join(OUTPUT_DIR, "05_privacy_portability.png"), "PNG")
    print("Slide 5 generated: 05_privacy_portability.png")

if __name__ == "__main__":
    print("Generating Google Play Store screenshots...")
    build_slide_1()
    build_slide_2()
    build_slide_3()
    build_slide_4()
    build_slide_5()
    print("All 5 screenshots successfully generated in 'store_screenshots/'!")
