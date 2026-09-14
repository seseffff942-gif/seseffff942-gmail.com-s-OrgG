import os
from PIL import Image, ImageDraw

source_path = "public/logo_final.jpg"
res_path = "android/app/src/main/res"

img = Image.open(source_path).convert("RGBA")

# Ensure square
width, height = img.size
min_dim = min(width, height)
left = (width - min_dim) // 2
top = (height - min_dim) // 2
square_img = img.crop((left, top, left + min_dim, top + min_dim))

densities = {
    "mipmap-mdpi": {"launcher": 48, "foreground": 108},
    "mipmap-hdpi": {"launcher": 72, "foreground": 162},
    "mipmap-xhdpi": {"launcher": 96, "foreground": 216},
    "mipmap-xxhdpi": {"launcher": 144, "foreground": 324},
    "mipmap-xxxhdpi": {"launcher": 192, "foreground": 432},
}

for folder, sizes in densities.items():
    folder_path = os.path.join(res_path, folder)
    os.makedirs(folder_path, exist_ok=True)
    
    # 1. Standard square launcher
    l_size = sizes["launcher"]
    resized_launcher = square_img.resize((l_size, l_size), Image.Resampling.LANCZOS)
    resized_launcher.save(os.path.join(folder_path, "ic_launcher.png"), "PNG")
    
    # 2. Round launcher (circular mask)
    mask = Image.new("L", (l_size, l_size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, l_size, l_size), fill=255)
    round_img = Image.new("RGBA", (l_size, l_size), (0, 0, 0, 0))
    round_img.paste(resized_launcher, (0, 0), mask=mask)
    round_img.save(os.path.join(folder_path, "ic_launcher_round.png"), "PNG")
    
    # 3. Adaptive foreground (safe zone is ~70% inside the canvas)
    fg_size = sizes["foreground"]
    inner_size = int(fg_size * 0.72)
    resized_inner = square_img.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
    
    fg_img = Image.new("RGBA", (fg_size, fg_size), (0, 0, 0, 0))
    offset = (fg_size - inner_size) // 2
    fg_img.paste(resized_inner, (offset, offset), mask=resized_inner if resized_inner.mode == "RGBA" else None)
    fg_img.save(os.path.join(folder_path, "ic_launcher_foreground.png"), "PNG")
    
    print(f"Generated icons for {folder}: {l_size}x{l_size}, fg {fg_size}x{fg_size}")

print("All Android launcher icons generated successfully!")
