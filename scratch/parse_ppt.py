import re

path = r"C:\Users\justi\Desktop\Justin Jacob Saju\SRM\Sem 6\SEM6 Project\iot-virtual-lab\showcase\src\app\ppt\page.tsx"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "id:" in line:
        snippet = "".join(lines[i:min(i+15, len(lines))])
        id_m = re.search(r'id:\s*"([^"]+)"', snippet)
        badge_m = re.search(r'badge:\s*"([^"]+)"', snippet)
        title_m = re.search(r'title:\s*"([^"]+)"', snippet)
        sub_m = re.search(r'subtitle:\s*"([^"]+)"', snippet)
        if id_m:
            id_val = id_m.group(1)
            b_val = badge_m.group(1) if badge_m else "None"
            t_val = title_m.group(1) if title_m else "None"
            s_val = sub_m.group(1) if sub_m else ""
            print(f"Slide: {id_val:15} | Badge: {b_val:18} | Title: {t_val} | Sub: {s_val}")
