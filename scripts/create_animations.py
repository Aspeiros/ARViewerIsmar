import math
import os
import sys

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

ANIMATIONS_DIR = os.path.join('media', 'animations')
os.makedirs(ANIMATIONS_DIR, exist_ok=True)

FONT_HEADING = 'media/fonts/TsukimiRounded-Bold.ttf'
FONT_POPPINS_BOLD = 'media/fonts/Poppins-Bold.ttf'
FONT_POPPINS_SEMI = 'media/fonts/Poppins-SemiBold.ttf'

COLOR_BROWN = (61, 18, 9, 255)       # #3D1209
COLOR_YELLOW = (255, 224, 0, 255)    # #FFE000
COLOR_ORANGE = (255, 170, 0, 255)    # #FFAA00
COLOR_RED = (234, 84, 84, 255)       # #EA5454
COLOR_BLUE = (0, 139, 242, 255)      # #008BF2
COLOR_DARK_BLUE = (0, 109, 242, 255) # #006DF2
COLOR_CREAM = (244, 232, 212, 255)   # #F4E8D4
COLOR_WHITE = (255, 255, 255, 255)

def get_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.truetype('segoeuib.ttf', size)

font_h1 = get_font(FONT_HEADING, 38)
font_h2 = get_font(FONT_HEADING, 30)
font_h3 = get_font(FONT_HEADING, 24)
font_sub = get_font(FONT_POPPINS_BOLD, 18)
font_tag = get_font(FONT_POPPINS_SEMI, 13)
font_stars = get_font(FONT_HEADING, 28)

def draw_spark(draw, cx, cy, size, alpha=255, color=COLOR_YELLOW):
    """Disegna una stella/spark a 4 punte luminosa"""
    c = (color[0], color[1], color[2], int(alpha))
    pts = [
        (cx, cy - size),
        (cx + size * 0.28, cy - size * 0.28),
        (cx + size, cy),
        (cx + size * 0.28, cy + size * 0.28),
        (cx, cy + size),
        (cx - size * 0.28, cy + size * 0.28),
        (cx - size, cy),
        (cx - size * 0.28, cy - size * 0.28),
    ]
    draw.polygon(pts, fill=c)

# ==============================================================================
# 1. WELCOME TO ISMAR 2026
# ==============================================================================
def create_welcome_ismar():
    print("Creazione animazione: Welcome to ISMAR 2026...")
    w, h = 600, 600
    logo_path = 'GraphicResources/Banners_&_logo/Logo.png'
    raw_logo = Image.open(logo_path).convert('RGBA')
    
    frames = []
    num_frames = 24
    
    for i in range(num_frames):
        t = i / num_frames
        angle = t * 2 * math.pi
        
        # Frame base trasparente per effetto ologramma AR
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        cx, cy = w // 2, h // 2
        radius = 270
        
        # Ombra morbida sotto il badge
        shadow_box = [cx - radius + 8, cy - radius + 14, cx + radius + 8, cy + radius + 14]
        draw.ellipse(shadow_box, fill=(40, 10, 5, 80))
        
        # Cerchio principale badge con gradiente beige/crema caldo
        badge_box = [cx - radius, cy - radius, cx + radius, cy + radius]
        draw.ellipse(badge_box, fill=(250, 245, 235, 250), outline=COLOR_BROWN, width=6)
        
        # Bordo interno dorato ISMAR
        inner_box = [cx - radius + 10, cy - radius + 10, cx + radius - 10, cy + radius - 10]
        draw.ellipse(inner_box, outline=COLOR_YELLOW, width=8)
        
        # Raggi rotanti di luce dorata di fondo (sunburst sottile)
        num_rays = 12
        for r in range(num_rays):
            ray_ang = angle * 0.5 + (r / num_rays) * 2 * math.pi
            rx = cx + math.cos(ray_ang) * (radius - 24)
            ry = cy + math.sin(ray_ang) * (radius - 24)
            draw.line([(cx, cy - 20), (rx, ry)], fill=(255, 224, 0, 35), width=4)
        
        # Kicker superiore
        kicker_text = "IEEE · BARI, ITALY"
        bbox_k = draw.textbbox((0, 0), kicker_text, font=font_tag)
        kw = bbox_k[2] - bbox_k[0]
        draw.text((cx - kw // 2, cy - radius + 32), kicker_text, font=font_tag, fill=COLOR_DARK_BLUE)
        
        # Logo Gallo fluttuante con respiro / pulsazione dolce
        float_y = math.sin(angle) * 8
        scale = 0.44 + math.cos(angle) * 0.02
        lw, lh = int(raw_logo.width * scale), int(raw_logo.height * scale)
        scaled_logo = raw_logo.resize((lw, lh), Image.Resampling.LANCZOS)
        
        logo_x = cx - lw // 2
        logo_y = cy - 145 + int(float_y)
        img.paste(scaled_logo, (logo_x, logo_y), scaled_logo)
        
        # Testi inferiori: WELCOME TO ISMAR 2026
        # "WELCOME TO"
        txt_wlc = "WELCOME TO"
        bbox_wlc = draw.textbbox((0, 0), txt_wlc, font=font_sub)
        wlc_w = bbox_wlc[2] - bbox_wlc[0]
        draw.text((cx - wlc_w // 2, cy + 50), txt_wlc, font=font_sub, fill=COLOR_BLUE)
        
        # "ISMAR 2026" con leggera ombra dorata
        txt_main = "ISMAR 2026"
        bbox_main = draw.textbbox((0, 0), txt_main, font=font_h1)
        main_w = bbox_main[2] - bbox_main[0]
        draw.text((cx - main_w // 2 + 2, cy + 76 + 2), txt_main, font=font_h1, fill=COLOR_YELLOW)
        draw.text((cx - main_w // 2, cy + 76), txt_main, font=font_h1, fill=COLOR_BROWN)
        
        # Sottotitolo conferenza
        txt_sub = "33rd IEEE Conference on VR & 3D UI"
        bbox_sub = draw.textbbox((0, 0), txt_sub, font=font_tag)
        sub_w = bbox_sub[2] - bbox_sub[0]
        draw.text((cx - sub_w // 2, cy + 130), txt_sub, font=font_tag, fill=COLOR_BROWN)
        
        # Stelle scintillanti animate intorno al logo
        s1 = 10 + math.sin(angle * 2) * 5
        draw_spark(draw, cx - 180, cy - 60, s1, 220)
        
        s2 = 12 + math.cos(angle * 2) * 5
        draw_spark(draw, cx + 180, cy - 40, s2, 240)
        
        s3 = 8 + math.sin(angle * 2 + 1) * 4
        draw_spark(draw, cx + 140, cy + 90, s3, 200, COLOR_RED)
        
        s4 = 9 + math.cos(angle * 2 + 1) * 4
        draw_spark(draw, cx - 140, cy + 85, s4, 200, COLOR_BLUE)
        
        frames.append(img)
        
    out_path = os.path.join(ANIMATIONS_DIR, 'Welcome_to_ISMAR_2026.gif')
    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=80,
        loop=0,
        disposal=2
    )
    print(f"✅ Salvato: {out_path} ({os.path.getsize(out_path)} bytes)")

# ==============================================================================
# 2. WELCOME TO BARI
# ==============================================================================
def create_welcome_bari():
    print("Creazione animazione: Welcome to Bari...")
    w, h = 600, 600
    petruzzelli_path = 'GraphicResources/Pictures/Bari/petruzzelli.JPG'
    raw_bg = Image.open(petruzzelli_path).convert('RGB')
    
    logo_path = 'GraphicResources/Banners_&_logo/Logo.png'
    raw_logo = Image.open(logo_path).convert('RGBA').resize((130, 100), Image.Resampling.LANCZOS)
    
    frames = []
    num_frames = 24
    
    # Prepara maschera circolare per la foto di Bari
    radius = 265
    cx, cy = w // 2, h // 2
    
    # Ritaglia centro foto
    min_dim = min(raw_bg.width, raw_bg.height)
    crop_x = (raw_bg.width - min_dim) // 2
    crop_y = (raw_bg.height - min_dim) // 2
    cropped_bg = raw_bg.crop((crop_x, crop_y, crop_x + min_dim, crop_y + min_dim)).resize((radius * 2, radius * 2), Image.Resampling.LANCZOS)
    
    circle_mask = Image.new('L', (radius * 2, radius * 2), 0)
    draw_mask = ImageDraw.Draw(circle_mask)
    draw_mask.ellipse([0, 0, radius * 2, radius * 2], fill=255)
    
    for i in range(num_frames):
        t = i / num_frames
        angle = t * 2 * math.pi
        
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Ombra
        draw.ellipse([cx - radius + 8, cy - radius + 14, cx + radius + 8, cy + radius + 14], fill=(40, 10, 5, 80))
        
        # Foto di Bari con maschera circolare
        bg_frame = Image.new('RGBA', (radius * 2, radius * 2), (0, 0, 0, 0))
        bg_frame.paste(cropped_bg, (0, 0))
        
        # Overlay gradiente caldo mediterraneo
        overlay = Image.new('RGBA', (radius * 2, radius * 2), (0, 0, 0, 0))
        draw_ov = ImageDraw.Draw(overlay)
        draw_ov.rectangle([0, 0, radius * 2, radius * 2], fill=(61, 18, 9, 70))
        draw_ov.rectangle([0, int(radius * 0.9), radius * 2, radius * 2], fill=(244, 232, 212, 220))
        bg_frame = Image.alpha_composite(bg_frame, overlay)
        
        img.paste(bg_frame, (cx - radius, cy - radius), circle_mask)
        
        # Bordi circolari ISMAR
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], outline=COLOR_BROWN, width=6)
        draw.ellipse([cx - radius + 8, cy - radius + 8, cx + radius - 8, cy + radius - 8], outline=COLOR_YELLOW, width=6)
        
        # Logo ISMAR in alto che galleggia
        float_y = math.sin(angle) * 6
        img.paste(raw_logo, (cx - raw_logo.width // 2, cy - radius + 22 + int(float_y)), raw_logo)
        
        # Cartiglio / Placca per il testo
        plaque_w = 460
        plaque_h = 175
        px0, py0 = cx - plaque_w // 2, cy + 30
        px1, py1 = cx + plaque_w // 2, py0 + plaque_h
        
        draw.rounded_rectangle([px0, py0, px1, py1], radius=24, fill=(255, 253, 248, 245), outline=COLOR_BROWN, width=4)
        draw.rounded_rectangle([px0 + 5, py0 + 5, px1 - 5, py1 - 5], radius=20, outline=COLOR_YELLOW, width=3)
        
        # Testi
        txt_wlc = "WELCOME TO"
        bbox_wlc = draw.textbbox((0, 0), txt_wlc, font=font_sub)
        draw.text((cx - (bbox_wlc[2] - bbox_wlc[0]) // 2, py0 + 16), txt_wlc, font=font_sub, fill=COLOR_DARK_BLUE)
        
        txt_bari = "BARI"
        bbox_bari = draw.textbbox((0, 0), txt_bari, font=font_h1)
        draw.text((cx - (bbox_bari[2] - bbox_bari[0]) // 2 + 2, py0 + 44 + 2), txt_bari, font=font_h1, fill=COLOR_YELLOW)
        draw.text((cx - (bbox_bari[2] - bbox_bari[0]) // 2, py0 + 44), txt_bari, font=font_h1, fill=COLOR_BROWN)
        
        txt_desc = "Gateway to the Mediterranean · Puglia, Italy"
        bbox_desc = draw.textbbox((0, 0), txt_desc, font=font_tag)
        draw.text((cx - (bbox_desc[2] - bbox_desc[0]) // 2, py0 + 104), txt_desc, font=font_tag, fill=COLOR_BROWN)
        
        txt_tag = "#ISMAR2026 · Host City"
        bbox_tag = draw.textbbox((0, 0), txt_tag, font=font_tag)
        draw.text((cx - (bbox_tag[2] - bbox_tag[0]) // 2, py0 + 132), txt_tag, font=font_tag, fill=COLOR_RED)
        
        # Scintille
        s1 = 11 + math.sin(angle * 2) * 5
        draw_spark(draw, px0 - 15, py0 + 30, s1, 240, COLOR_YELLOW)
        s2 = 11 + math.cos(angle * 2) * 5
        draw_spark(draw, px1 + 15, py0 + 30, s2, 240, COLOR_YELLOW)
        
        frames.append(img)
        
    out_path = os.path.join(ANIMATIONS_DIR, 'Welcome_to_Bari.gif')
    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=80,
        loop=0,
        disposal=2
    )
    print(f"✅ Salvato: {out_path} ({os.path.getsize(out_path)} bytes)")

# ==============================================================================
# 3. WELCOME TO THE NICHOLAUS HOTEL (VENUE)
# ==============================================================================
def create_welcome_hotel():
    print("Creazione animazione: Welcome to The Nicholaus Hotel...")
    w, h = 600, 600
    logo_path = 'GraphicResources/Banners_&_logo/Logo.png'
    raw_logo = Image.open(logo_path).convert('RGBA').resize((120, 92), Image.Resampling.LANCZOS)
    
    frames = []
    num_frames = 24
    
    cx, cy = w // 2, h // 2
    radius = 265
    
    for i in range(num_frames):
        t = i / num_frames
        angle = t * 2 * math.pi
        
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Ombra
        draw.ellipse([cx - radius + 8, cy - radius + 14, cx + radius + 8, cy + radius + 14], fill=(40, 10, 5, 80))
        
        # Fondo badge crema ISMAR
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(255, 252, 246, 252), outline=COLOR_BROWN, width=6)
        draw.ellipse([cx - radius + 8, cy - radius + 8, cx + radius - 8, cy + radius - 8], outline=COLOR_YELLOW, width=6)
        
        # Cerchi radar/beacon XR pulsanti
        radar_r1 = 60 + (i % 12) * 8
        radar_alpha = int(max(0, 160 - (i % 12) * 13))
        draw.ellipse([cx - radar_r1, cy - 90 - radar_r1, cx + radar_r1, cy - 90 + radar_r1], outline=(0, 139, 242, radar_alpha), width=2)
        
        radar_r2 = 60 + ((i + 6) % 12) * 8
        radar_alpha2 = int(max(0, 160 - ((i + 6) % 12) * 13))
        draw.ellipse([cx - radar_r2, cy - 90 - radar_r2, cx + radar_r2, cy - 90 + radar_r2], outline=(255, 224, 0, radar_alpha2), width=2)
        
        # Logo e Icona Location Venue
        float_y = math.sin(angle) * 5
        img.paste(raw_logo, (cx - raw_logo.width // 2, cy - 145 + int(float_y)), raw_logo)
        
        # 4 Stelle Hotel animate
        stars_str = "★★★★"
        bbox_st = draw.textbbox((0, 0), stars_str, font=font_stars)
        draw.text((cx - (bbox_st[2] - bbox_st[0]) // 2, cy - 40), stars_str, font=font_stars, fill=COLOR_YELLOW)
        
        # Badge venue "OFFICIAL VENUE"
        vbox_w = 230
        vbox_h = 28
        vx0, vy0 = cx - vbox_w // 2, cy + 4
        draw.rounded_rectangle([vx0, vy0, vx0 + vbox_w, vy0 + vbox_h], radius=14, fill=COLOR_RED)
        lbl_venue = "OFFICIAL VENUE"
        bbox_lv = draw.textbbox((0, 0), lbl_venue, font=font_tag)
        draw.text((cx - (bbox_lv[2] - bbox_lv[0]) // 2, vy0 + 6), lbl_venue, font=font_tag, fill=COLOR_WHITE)
        
        # Testi Hotel
        txt_wlc = "WELCOME TO"
        bbox_wlc = draw.textbbox((0, 0), txt_wlc, font=font_sub)
        draw.text((cx - (bbox_wlc[2] - bbox_wlc[0]) // 2, cy + 42), txt_wlc, font=font_sub, fill=COLOR_DARK_BLUE)
        
        txt_hotel = "THE NICHOLAUS"
        bbox_hotel = draw.textbbox((0, 0), txt_hotel, font=font_h2)
        draw.text((cx - (bbox_hotel[2] - bbox_hotel[0]) // 2 + 2, cy + 68 + 2), txt_hotel, font=font_h2, fill=COLOR_YELLOW)
        draw.text((cx - (bbox_hotel[2] - bbox_hotel[0]) // 2, cy + 68), txt_hotel, font=font_h2, fill=COLOR_BROWN)
        
        txt_hotel2 = "HOTEL BARI"
        bbox_hotel2 = draw.textbbox((0, 0), txt_hotel2, font=font_h3)
        draw.text((cx - (bbox_hotel2[2] - bbox_hotel2[0]) // 2, cy + 104), txt_hotel2, font=font_h3, fill=COLOR_BROWN)
        
        txt_foot = "Conference & Exhibition Center · ISMAR 2026"
        bbox_foot = draw.textbbox((0, 0), txt_foot, font=font_tag)
        draw.text((cx - (bbox_foot[2] - bbox_foot[0]) // 2, cy + 148), txt_foot, font=font_tag, fill=COLOR_BROWN)
        
        # Scintille laterali
        s1 = 10 + math.sin(angle * 2) * 4
        draw_spark(draw, cx - 180, cy - 20, s1, 230, COLOR_YELLOW)
        s2 = 10 + math.cos(angle * 2) * 4
        draw_spark(draw, cx + 180, cy - 20, s2, 230, COLOR_YELLOW)
        
        frames.append(img)
        
    out_path = os.path.join(ANIMATIONS_DIR, 'Welcome_to_Nicholaus_Hotel.gif')
    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=80,
        loop=0,
        disposal=2
    )
    print(f"✅ Salvato: {out_path} ({os.path.getsize(out_path)} bytes)")

# ==============================================================================
# 4. TASTE PUGLIA (GASTRONOMIA)
# ==============================================================================
def create_taste_puglia():
    print("Creazione animazione: Taste Puglia...")
    w, h = 600, 600
    focaccia_path = 'GraphicResources/Pictures/Gastronomy/focaccia.JPG'
    orecchiette_path = 'GraphicResources/Pictures/Gastronomy/orecchiette.JPG'
    
    img_focaccia = Image.open(focaccia_path).convert('RGB')
    img_orecchiette = Image.open(orecchiette_path).convert('RGB')
    
    logo_path = 'GraphicResources/Banners_&_logo/Logo.png'
    raw_logo = Image.open(logo_path).convert('RGBA').resize((110, 84), Image.Resampling.LANCZOS)
    
    frames = []
    num_frames = 24
    cx, cy = w // 2, h // 2
    radius = 265
    
    # Prepara maschera e crop
    min_f = min(img_focaccia.width, img_focaccia.height)
    crop_f = img_focaccia.crop(((img_focaccia.width - min_f) // 2, (img_focaccia.height - min_f) // 2, (img_focaccia.width + min_f) // 2, (img_focaccia.height + min_f) // 2)).resize((radius * 2, radius * 2), Image.Resampling.LANCZOS)
    
    min_o = min(img_orecchiette.width, img_orecchiette.height)
    crop_o = img_orecchiette.crop(((img_orecchiette.width - min_o) // 2, (img_orecchiette.height - min_o) // 2, (img_orecchiette.width + min_o) // 2, (img_orecchiette.height + min_o) // 2)).resize((radius * 2, radius * 2), Image.Resampling.LANCZOS)
    
    circle_mask = Image.new('L', (radius * 2, radius * 2), 0)
    draw_mask = ImageDraw.Draw(circle_mask)
    draw_mask.ellipse([0, 0, radius * 2, radius * 2], fill=255)
    
    for i in range(num_frames):
        t = i / num_frames
        angle = t * 2 * math.pi
        
        # Dissolvenza morbida alternata tra focaccia e orecchiette
        blend_factor = (math.sin(angle) + 1) / 2
        food_blend = Image.blend(crop_f, crop_o, blend_factor)
        
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Ombra
        draw.ellipse([cx - radius + 8, cy - radius + 14, cx + radius + 8, cy + radius + 14], fill=(40, 10, 5, 80))
        
        # Immagine cibo circolare con overlay semitrasparente
        bg_frame = Image.new('RGBA', (radius * 2, radius * 2), (0, 0, 0, 0))
        bg_frame.paste(food_blend, (0, 0))
        
        overlay = Image.new('RGBA', (radius * 2, radius * 2), (0, 0, 0, 0))
        draw_ov = ImageDraw.Draw(overlay)
        draw_ov.rectangle([0, 0, radius * 2, radius * 2], fill=(61, 18, 9, 75))
        draw_ov.rectangle([0, int(radius * 0.95), radius * 2, radius * 2], fill=(255, 252, 246, 235))
        bg_frame = Image.alpha_composite(bg_frame, overlay)
        
        img.paste(bg_frame, (cx - radius, cy - radius), circle_mask)
        
        # Cornice ceramica pugliese ISMAR
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], outline=COLOR_BROWN, width=6)
        draw.ellipse([cx - radius + 8, cy - radius + 8, cx + radius - 8, cy + radius - 8], outline=COLOR_YELLOW, width=6)
        
        # Logo Gallo in alto
        float_y = math.sin(angle) * 5
        img.paste(raw_logo, (cx - raw_logo.width // 2, cy - radius + 24 + int(float_y)), raw_logo)
        
        # Placca testo
        plaque_w = 460
        plaque_h = 160
        px0, py0 = cx - plaque_w // 2, cy + 40
        px1, py1 = cx + plaque_w // 2, py0 + plaque_h
        
        draw.rounded_rectangle([px0, py0, px1, py1], radius=24, fill=(255, 253, 248, 245), outline=COLOR_BROWN, width=4)
        draw.rounded_rectangle([px0 + 5, py0 + 5, px1 - 5, py1 - 5], radius=20, outline=COLOR_YELLOW, width=3)
        
        # Testo
        txt_top = "LOCAL FLAVORS & TRADITIONS"
        bbox_top = draw.textbbox((0, 0), txt_top, font=font_tag)
        draw.text((cx - (bbox_top[2] - bbox_top[0]) // 2, py0 + 14), txt_top, font=font_tag, fill=COLOR_DARK_BLUE)
        
        txt_taste = "TASTE PUGLIA"
        bbox_taste = draw.textbbox((0, 0), txt_taste, font=font_h1)
        draw.text((cx - (bbox_taste[2] - bbox_taste[0]) // 2 + 2, py0 + 38 + 2), txt_taste, font=font_h1, fill=COLOR_YELLOW)
        draw.text((cx - (bbox_taste[2] - bbox_taste[0]) // 2, py0 + 38), txt_taste, font=font_h1, fill=COLOR_BROWN)
        
        txt_foods = "Orecchiette · Focaccia Barese · Burrata"
        bbox_foods = draw.textbbox((0, 0), txt_foods, font=font_sub)
        draw.text((cx - (bbox_foods[2] - bbox_foods[0]) // 2, py0 + 94), txt_foods, font=font_sub, fill=COLOR_RED)
        
        txt_tag = "ISMAR 2026 Gastronomy Track"
        bbox_tag = draw.textbbox((0, 0), txt_tag, font=font_tag)
        draw.text((cx - (bbox_tag[2] - bbox_tag[0]) // 2, py0 + 124), txt_tag, font=font_tag, fill=COLOR_BROWN)
        
        # Scintille
        s1 = 10 + math.sin(angle * 2) * 4
        draw_spark(draw, px0 - 14, py0 + 32, s1, 230, COLOR_YELLOW)
        s2 = 10 + math.cos(angle * 2) * 4
        draw_spark(draw, px1 + 14, py0 + 32, s2, 230, COLOR_YELLOW)
        
        frames.append(img)
        
    out_path = os.path.join(ANIMATIONS_DIR, 'Taste_Puglia.gif')
    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=80,
        loop=0,
        disposal=2
    )
    print(f"✅ Salvato: {out_path} ({os.path.getsize(out_path)} bytes)")

if __name__ == '__main__':
    create_welcome_ismar()
    create_welcome_bari()
    create_welcome_hotel()
    create_taste_puglia()
    print("\n🎉 Tutte le animazioni sono state create con successo in media/animations/!")
