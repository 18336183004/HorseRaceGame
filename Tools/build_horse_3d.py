import os
import struct
import json
import numpy as np
from PIL import Image

def create_glb(nodes, meshes, accessors, buffer_views, binary_data, materials=None):
    """
    Creates a standard glTF 2.0 binary (.glb) file.
    """
    gltf_dict = {
        "asset": {
            "version": "2.0",
            "generator": "HorseRaceGame 3D Procedural Generator"
        },
        "scene": 0,
        "scenes": [{ "nodes": [0] }],
        "nodes": nodes,
        "meshes": meshes,
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{ "byteLength": len(binary_data) }]
    }
    if materials:
        gltf_dict["materials"] = materials

    json_bytes = json.dumps(gltf_dict).encode("utf-8")
    # Pad JSON to 4-byte boundary with spaces
    json_padding = (4 - (len(json_bytes) % 4)) % 4
    json_bytes += b" " * json_padding

    # Pad binary data to 4-byte boundary with null bytes
    bin_padding = (4 - (len(binary_data) % 4)) % 4
    padded_binary = binary_data + (b"\x00" * bin_padding)

    total_len = 12 + 8 + len(json_bytes) + 8 + len(padded_binary)

    glb = bytearray()
    # 12-byte header: magic(0x46546C67), version(2), length
    glb.extend(struct.pack("<4sII", b"glTF", 2, total_len))
    # Chunk 0: JSON
    glb.extend(struct.pack("<II", len(json_bytes), 0x4E4F534A))
    glb.extend(json_bytes)
    # Chunk 1: BIN
    glb.extend(struct.pack("<II", len(padded_binary), 0x004E4942))
    glb.extend(padded_binary)

    return bytes(glb)

def build_horse_geometry(coat_rgb, horse_no):
    """
    Builds a 3D anatomical horse mesh based on classical purebred proportions:
    - Torso: curved barrel with chest, belly, and haunches
    - Neck: angled upward & arched
    - Head: tapered muzzle, jaw, ears
    - 4 Legs: forelegs (shoulder, knee, cannon, hoof), hindlegs (stifle, hock, cannon, hoof)
    - Tail: flowing downward
    - Saddle: on wither
    """
    positions = []
    normals = []
    uvs = []
    indices = []
    
    def add_quad(p0, p1, p2, p3, n, uv0=(0,0), uv1=(1,0), uv2=(1,1), uv3=(0,1)):
        start = len(positions) // 3
        positions.extend(p0 + p1 + p2 + p3)
        normals.extend(n + n + n + n)
        uvs.extend(uv0 + uv1 + uv2 + uv3)
        indices.extend([start, start+1, start+2, start, start+2, start+3])

    def add_box(center, size, n_mult=1.0):
        cx, cy, cz = center
        sx, sy, sz = [s * 0.5 for s in size]
        
        # 6 faces
        # Top (+Y)
        add_quad([cx-sx, cy+sy, cz+sz], [cx+sx, cy+sy, cz+sz], [cx+sx, cy+sy, cz-sz], [cx-sx, cy+sy, cz-sz], [0, 1*n_mult, 0])
        # Bottom (-Y)
        add_quad([cx-sx, cy-sy, cz-sz], [cx+sx, cy-sy, cz-sz], [cx+sx, cy-sy, cz+sz], [cx-sx, cy-sy, cz+sz], [0, -1*n_mult, 0])
        # Front (+X)
        add_quad([cx+sx, cy-sy, cz+sz], [cx+sx, cy-sy, cz-sz], [cx+sx, cy+sy, cz-sz], [cx+sx, cy+sy, cz+sz], [1*n_mult, 0, 0])
        # Back (-X)
        add_quad([cx-sx, cy-sy, cz-sz], [cx-sx, cy-sy, cz+sz], [cx-sx, cy+sy, cz+sz], [cx-sx, cy+sy, cz-sz], [-1*n_mult, 0, 0])
        # Right (+Z)
        add_quad([cx-sx, cy-sy, cz+sz], [cx+sx, cy-sy, cz+sz], [cx+sx, cy+sy, cz+sz], [cx-sx, cy+sy, cz+sz], [0, 0, 1*n_mult])
        # Left (-Z)
        add_quad([cx+sx, cy-sy, cz-sz], [cx-sx, cy-sy, cz-sz], [cx-sx, cy+sy, cz-sz], [cx+sx, cy+sy, cz-sz], [0, 0, -1*n_mult])

    # 1. Torso Barrel (Chest to Rump)
    add_box([0.0, 1.25, 0.0], [1.3, 0.55, 0.48])       # Main barrel
    add_box([0.5, 1.30, 0.0], [0.4, 0.60, 0.44])       # Chest / Shoulder
    add_box([-0.55, 1.28, 0.0], [0.45, 0.58, 0.46])    # Haunches / Rump

    # 2. Neck (Angled forward-upward)
    add_box([0.75, 1.62, 0.0], [0.35, 0.55, 0.26])

    # 3. Head & Muzzle
    add_box([0.98, 1.82, 0.0], [0.42, 0.28, 0.22])     # Skull
    add_box([1.18, 1.74, 0.0], [0.26, 0.18, 0.16])     # Muzzle
    # Ears
    add_box([0.92, 2.02, 0.07], [0.08, 0.16, 0.06])    # Left ear
    add_box([0.92, 2.02, -0.07], [0.08, 0.16, 0.06])   # Right ear

    # 4. Mane
    add_box([0.65, 1.80, 0.0], [0.15, 0.45, 0.08])

    # 5. Tail
    add_box([-0.82, 1.05, 0.0], [0.18, 0.65, 0.14])

    # 6. Forelegs
    # Front-Left (+Z)
    add_box([0.52, 0.85, 0.18], [0.16, 0.55, 0.16])    # Shoulder/Forearm
    add_box([0.52, 0.32, 0.18], [0.12, 0.52, 0.12])    # Cannon
    add_box([0.54, 0.04, 0.18], [0.15, 0.08, 0.14])    # Hoof
    # Front-Right (-Z)
    add_box([0.52, 0.85, -0.18], [0.16, 0.55, 0.16])   # Shoulder/Forearm
    add_box([0.52, 0.32, -0.18], [0.12, 0.52, 0.12])   # Cannon
    add_box([0.54, 0.04, -0.18], [0.15, 0.08, 0.14])   # Hoof

    # 7. Hindlegs
    # Hind-Left (+Z)
    add_box([-0.50, 0.88, 0.19], [0.22, 0.55, 0.18])   # Thigh/Gaskin
    add_box([-0.55, 0.32, 0.19], [0.12, 0.52, 0.12])   # Cannon
    add_box([-0.53, 0.04, 0.19], [0.15, 0.08, 0.14])   # Hoof
    # Hind-Right (-Z)
    add_box([-0.50, 0.88, -0.19], [0.22, 0.55, 0.18])  # Thigh/Gaskin
    add_box([-0.55, 0.32, -0.19], [0.12, 0.52, 0.12])  # Cannon
    add_box([-0.53, 0.04, -0.19], [0.15, 0.08, 0.14])  # Hoof

    # 8. Saddle & Cloth
    add_box([0.05, 1.56, 0.0], [0.42, 0.10, 0.52])     # Saddle cloth

    return positions, normals, uvs, indices

def generate_all_horses():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(base_dir, ".."))
    models_dir = os.path.join(project_root, "Client", "assets", "models")
    os.makedirs(models_dir, exist_ok=True)

    horse_colors = [
        [0.60, 0.20, 0.12], # 1: 赤焰流星 (Chestnut)
        [0.74, 0.77, 0.79], # 2: 翠风 (Dapple Grey)
        [0.85, 0.67, 0.29], # 3: 金色箭头 (Golden Arrow)
        [0.15, 0.15, 0.16], # 4: 暗影猎手 (Shadow Hunter)
        [0.93, 0.94, 0.96], # 5: 银月 (Silver Moon)
        [0.36, 0.45, 0.54], # 6: 蓝潮 (Blue Tide)
        [0.49, 0.19, 0.33], # 7: 紫电
        [0.46, 0.29, 0.19], # 8: 风暴
        [0.29, 0.20, 0.16], # 9: 惊雷
        [0.66, 0.16, 0.14], # 10: 烈阳
        [0.69, 0.63, 0.45], # 11: 翡翠
        [0.33, 0.24, 0.19], # 12: 极光
        [0.76, 0.45, 0.18], # 13: 炽天
        [0.62, 0.29, 0.16], # 14: 旷野
        [0.84, 0.85, 0.88], # 15: 白银
        [0.13, 0.13, 0.16], # 16: 黑曜
        [0.47, 0.51, 0.55], # 17: 月影
        [0.43, 0.26, 0.14], # 18: 狂角
        [0.78, 0.48, 0.16], # 19: 金雕
        [0.12, 0.14, 0.22]  # 20: 渊影
    ]

    for horse_no in range(1, 21):
        coat = horse_colors[horse_no - 1]
        positions, normals, uvs, indices = build_horse_geometry(coat, horse_no)
        
        pos_arr = np.array(positions, dtype=np.float32)
        norm_arr = np.array(normals, dtype=np.float32)
        uv_arr = np.array(uvs, dtype=np.float32)
        idx_arr = np.array(indices, dtype=np.uint16)

        pos_bytes = pos_arr.tobytes()
        norm_bytes = norm_arr.tobytes()
        uv_bytes = uv_arr.tobytes()
        idx_bytes = idx_arr.tobytes()

        # Pack into one continuous buffer
        bin_data = bytearray()
        
        # Offset 0: Positions
        offset_pos = len(bin_data)
        bin_data.extend(pos_bytes)

        # Offset 1: Normals
        offset_norm = len(bin_data)
        bin_data.extend(norm_bytes)

        # Offset 2: UVs
        offset_uv = len(bin_data)
        bin_data.extend(uv_bytes)

        # Offset 3: Indices
        offset_idx = len(bin_data)
        bin_data.extend(idx_bytes)

        buffer_views = [
            { "buffer": 0, "byteOffset": offset_pos, "byteLength": len(pos_bytes), "target": 34962 }, # ARRAY_BUFFER
            { "buffer": 0, "byteOffset": offset_norm, "byteLength": len(norm_bytes), "target": 34962 },
            { "buffer": 0, "byteOffset": offset_uv, "byteLength": len(uv_bytes), "target": 34962 },
            { "buffer": 0, "byteOffset": offset_idx, "byteLength": len(idx_bytes), "target": 34963 }  # ELEMENT_ARRAY_BUFFER
        ]

        pos_min = pos_arr.reshape(-1, 3).min(axis=0).tolist()
        pos_max = pos_arr.reshape(-1, 3).max(axis=0).tolist()

        accessors = [
            { "bufferView": 0, "byteOffset": 0, "componentType": 5126, "count": len(positions) // 3, "type": "VEC3", "min": pos_min, "max": pos_max },
            { "bufferView": 1, "byteOffset": 0, "componentType": 5126, "count": len(normals) // 3, "type": "VEC3" },
            { "bufferView": 2, "byteOffset": 0, "componentType": 5126, "count": len(uvs) // 2, "type": "VEC2" },
            { "bufferView": 3, "byteOffset": 0, "componentType": 5123, "count": len(indices), "type": "SCALAR" }
        ]

        materials = [{
            "name": f"Horse_{horse_no:02d}_Material",
            "pbrMetallicRoughness": {
                "baseColorFactor": [coat[0], coat[1], coat[2], 1.0],
                "metallicFactor": 0.1,
                "roughnessFactor": 0.65
            }
        }]

        meshes = [{
            "name": f"Horse_{horse_no:02d}_Mesh",
            "primitives": [{
                "attributes": {
                    "POSITION": 0,
                    "NORMAL": 1,
                    "TEXCOORD_0": 2
                },
                "indices": 3,
                "material": 0
            }]
        }]

        nodes = [{
            "name": f"Horse_{horse_no:02d}",
            "mesh": 0,
            "translation": [0, 0, 0],
            "rotation": [0, 0, 0, 1],
            "scale": [1, 1, 1]
        }]

        glb_bytes = create_glb(nodes, meshes, accessors, buffer_views, bin_data, materials)
        
        file_path = os.path.join(models_dir, f"Horse_{horse_no:02d}.glb")
        with open(file_path, "wb") as f:
            f.write(glb_bytes)
        print(f"Generated 3D Model: {file_path} ({len(glb_bytes)} bytes)")

if __name__ == "__main__":
    generate_all_horses()
