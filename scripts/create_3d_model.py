import struct
import json
import math
import os
import sys
from PIL import Image, ImageDraw, ImageFont

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

OUTPUT_DIR = os.path.join('media', '3d_models')
os.makedirs(OUTPUT_DIR, exist_ok=True)
OUTPUT_GLB = os.path.join(OUTPUT_DIR, 'ISMAR_3D_Logo.glb')

print("Generazione texture per modello 3D...")
# Texture 512x512 dorata con Logo ISMAR
tex_size = 512
tex_img = Image.new('RGBA', (tex_size, tex_size), (255, 255, 255, 0))
draw = ImageDraw.Draw(tex_img)

cx, cy = tex_size // 2, tex_size // 2
r = 240

# Fondo moneta dorata metallica
draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 224, 0, 255), outline=(61, 18, 9, 255), width=10)
draw.ellipse([cx - r + 16, cy - r + 16, cx + r - 16, cy + r - 16], outline=(255, 170, 0, 255), width=6)

# Carica Logo ISMAR
logo_path = 'GraphicResources/Banners_&_logo/Logo.png'
if os.path.exists(logo_path):
    logo = Image.open(logo_path).convert('RGBA')
    scale = 260 / max(logo.width, logo.height)
    lw, lh = int(logo.width * scale), int(logo.height * scale)
    logo_resized = logo.resize((lw, lh), Image.Resampling.LANCZOS)
    tex_img.paste(logo_resized, (cx - lw // 2, cy - lh // 2 - 10), logo_resized)

# Testo ISMAR 2026
try:
    font_bold = ImageFont.truetype('media/fonts/TsukimiRounded-Bold.ttf', 32)
except Exception:
    font_bold = ImageFont.truetype('segoeuib.ttf', 32)

bbox = draw.textbbox((0, 0), "ISMAR 2026", font=font_bold)
tw = bbox[2] - bbox[0]
draw.text((cx - tw // 2, cy + 135), "ISMAR 2026", font=font_bold, fill=(61, 18, 9, 255))

tex_bytes_io = os.path.join(OUTPUT_DIR, 'tex_temp.png')
tex_img.save(tex_bytes_io, format='PNG')
with open(tex_bytes_io, 'rb') as f:
    tex_png_bytes = f.read()
os.remove(tex_bytes_io)

print(f"Texture creata: {len(tex_png_bytes)} bytes")

# Creazione Geometria 3D: Cilindro/Moneta 3D (32 segmenti)
N = 32
radius = 1.0
thickness = 0.22

vertices = []
normals = []
uvs = []
indices = []

# Centro superiore (indice 0)
vertices.append((0.0, thickness / 2, 0.0))
normals.append((0.0, 1.0, 0.0))
uvs.append((0.5, 0.5))

# Cerchio superiore
for i in range(N):
    theta = i * 2 * math.pi / N
    x = radius * math.cos(theta)
    z = radius * math.sin(theta)
    u = 0.5 + 0.5 * math.cos(theta)
    v = 0.5 - 0.5 * math.sin(theta)
    vertices.append((x, thickness / 2, z))
    normals.append((0.0, 1.0, 0.0))
    uvs.append((u, v))

# Triangoli faccia superiore
for i in range(1, N + 1):
    next_i = 1 if i == N else i + 1
    indices.extend([0, next_i, i])

# Centro inferiore
idx_bottom_center = len(vertices)
vertices.append((0.0, -thickness / 2, 0.0))
normals.append((0.0, -1.0, 0.0))
uvs.append((0.5, 0.5))

# Cerchio inferiore
idx_bottom_start = len(vertices)
for i in range(N):
    theta = i * 2 * math.pi / N
    x = radius * math.cos(theta)
    z = radius * math.sin(theta)
    u = 0.5 + 0.5 * math.cos(theta)
    v = 0.5 + 0.5 * math.sin(theta)
    vertices.append((x, -thickness / 2, z))
    normals.append((0.0, -1.0, 0.0))
    uvs.append((u, v))

# Triangoli faccia inferiore
for i in range(N):
    curr_i = idx_bottom_start + i
    next_i = idx_bottom_start + ((i + 1) % N)
    indices.extend([idx_bottom_center, curr_i, next_i])

# Bordo laterale (Side rim)
idx_side_start = len(vertices)
for i in range(N + 1):
    theta = (i % N) * 2 * math.pi / N
    x = radius * math.cos(theta)
    z = radius * math.sin(theta)
    nx = math.cos(theta)
    nz = math.sin(theta)
    u = i / N
    
    # Vertice superiore laterale
    vertices.append((x, thickness / 2, z))
    normals.append((nx, 0.0, nz))
    uvs.append((u, 0.0))
    
    # Vertice inferiore laterale
    vertices.append((x, -thickness / 2, z))
    normals.append((nx, 0.0, nz))
    uvs.append((u, 1.0))

for i in range(N):
    top1 = idx_side_start + i * 2
    bot1 = top1 + 1
    top2 = idx_side_start + (i + 1) * 2
    bot2 = top2 + 1
    indices.extend([top1, bot1, top2])
    indices.extend([top2, bot1, bot2])

# Calcolo min/max per bounding box
min_pos = [min(v[c] for v in vertices) for c in range(3)]
max_pos = [max(v[c] for v in vertices) for c in range(3)]

# Serializzazione binaria (Little Endian)
bin_positions = bytearray()
for v in vertices:
    bin_positions.extend(struct.pack('<fff', v[0], v[1], v[2]))

bin_normals = bytearray()
for n in normals:
    bin_normals.extend(struct.pack('<fff', n[0], n[1], n[2]))

bin_uvs = bytearray()
for uv in uvs:
    bin_uvs.extend(struct.pack('<ff', uv[0], uv[1]))

bin_indices = bytearray()
for idx in indices:
    bin_indices.extend(struct.pack('<H', idx))

# Padding binario a multipli di 4
def pad4(data):
    rem = len(data) % 4
    if rem > 0:
        data.extend(b'\x00' * (4 - rem))
    return data

bin_indices = pad4(bin_indices)
bin_positions = pad4(bin_positions)
bin_normals = pad4(bin_normals)
bin_uvs = pad4(bin_uvs)
tex_png_bytes_padded = bytearray(tex_png_bytes)
tex_png_bytes_padded = pad4(tex_png_bytes_padded)

# Assemblaggio Buffer Unico
total_buffer = bytearray()

offset_indices = len(total_buffer)
total_buffer.extend(bin_indices)
len_indices = len(bin_indices)

offset_positions = len(total_buffer)
total_buffer.extend(bin_positions)
len_positions = len(bin_positions)

offset_normals = len(total_buffer)
total_buffer.extend(bin_normals)
len_normals = len(bin_normals)

offset_uvs = len(total_buffer)
total_buffer.extend(bin_uvs)
len_uvs = len(bin_uvs)

offset_img = len(total_buffer)
total_buffer.extend(tex_png_bytes_padded)
len_img = len(tex_png_bytes_padded)

# glTF JSON Document
gltf = {
    "asset": {"version": "2.0", "generator": "ISMAR 3D Generator"},
    "scenes": [{"nodes": [0]}],
    "scene": 0,
    "nodes": [{"mesh": 0, "name": "ISMAR_3D_Coin"}],
    "meshes": [{
        "primitives": [{
            "attributes": {
                "POSITION": 1,
                "NORMAL": 2,
                "TEXCOORD_0": 3
            },
            "indices": 0,
            "material": 0
        }],
        "name": "CoinMesh"
    }],
    "materials": [{
        "name": "CoinGoldMaterial",
        "pbrMetallicRoughness": {
            "baseColorTexture": {"index": 0},
            "metallicFactor": 0.85,
            "roughnessFactor": 0.25
        }
    }],
    "textures": [{"sampler": 0, "source": 0}],
    "images": [{"bufferView": 4, "mimeType": "image/png"}],
    "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
    "accessors": [
        {
            "bufferView": 0,
            "byteOffset": 0,
            "componentType": 5123, # UNSIGNED_SHORT
            "count": len(indices),
            "type": "SCALAR"
        },
        {
            "bufferView": 1,
            "byteOffset": 0,
            "componentType": 5126, # FLOAT
            "count": len(vertices),
            "type": "VEC3",
            "min": min_pos,
            "max": max_pos
        },
        {
            "bufferView": 2,
            "byteOffset": 0,
            "componentType": 5126, # FLOAT
            "count": len(normals),
            "type": "VEC3"
        },
        {
            "bufferView": 3,
            "byteOffset": 0,
            "componentType": 5126, # FLOAT
            "count": len(uvs),
            "type": "VEC2"
        }
    ],
    "bufferViews": [
        {"buffer": 0, "byteOffset": offset_indices, "byteLength": len_indices, "target": 34963}, # ELEMENT_ARRAY_BUFFER
        {"buffer": 0, "byteOffset": offset_positions, "byteLength": len_positions, "target": 34962}, # ARRAY_BUFFER
        {"buffer": 0, "byteOffset": offset_normals, "byteLength": len_normals, "target": 34962}, # ARRAY_BUFFER
        {"buffer": 0, "byteOffset": offset_uvs, "byteLength": len_uvs, "target": 34962}, # ARRAY_BUFFER
        {"buffer": 0, "byteOffset": offset_img, "byteLength": len_img}
    ],
    "buffers": [{"byteLength": len(total_buffer)}]
}

json_str = json.dumps(gltf, separators=(',', ':'))
json_bytes = bytearray(json_str.encode('utf-8'))
# Padding JSON a multipli di 4 con spazi
json_rem = len(json_bytes) % 4
if json_rem > 0:
    json_bytes.extend(b' ' * (4 - json_rem))

total_glb_len = 12 + 8 + len(json_bytes) + 8 + len(total_buffer)

# Assemblaggio GLB
glb_file = bytearray()
# Header (12 bytes)
glb_file.extend(struct.pack('<III', 0x46546C67, 2, total_glb_len))
# Chunk 0: JSON (8 bytes header + json)
glb_file.extend(struct.pack('<II', len(json_bytes), 0x4E4F534A)) # 'JSON'
glb_file.extend(json_bytes)
# Chunk 1: BIN (8 bytes header + binary)
glb_file.extend(struct.pack('<II', len(total_buffer), 0x004E4942)) # 'BIN\0'
glb_file.extend(total_buffer)

with open(OUTPUT_GLB, 'wb') as f:
    f.write(glb_file)

print(f"Modello 3D GLB creato con successo: {OUTPUT_GLB} ({len(glb_file)} bytes)")
