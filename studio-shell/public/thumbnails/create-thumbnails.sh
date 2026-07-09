#!/bin/bash

models=(
  "Bench-A" "Bench-B" "Boots" "Cobblestones" "Doormat"
  "Fence-Corner" "Fence-Open-Long" "Fence-Open-Wide-Long" "Fence-Open" "Fence-Post"
  "Fence-Rails-Long" "Fence-Rails" "Fence-Straight-Long" "Fence-Straight" "Fence-Wide-Long"
  "Floor-Base" "Foliage-A" "Foliage-B" "Gate-Double-Left" "Gate-Double-Right"
  "Gate-Single" "House" "Letter" "Mailbox" "Package" "Tree-Large" "Tree"
)

colors=("#e67e22" "#3498db" "#2ecc71" "#f39c12" "#9b59b6" "#1abc9c" "#e74c3c")

for i in "${!models[@]}"; do
  model="${models[$i]}"
  color="${colors[$((i % ${#colors[@]}))]}"
  label=$(echo "$model" | sed 's/-/ /g')
  
  cat > "${model}.png.svg" << SVGEOF
<svg width="108" height="108" viewBox="0 0 108 108" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="108" height="108" rx="8" fill="#1a1a1f"/>
  <rect x="20" y="20" width="68" height="68" rx="4" fill="${color}" opacity="0.15"/>
  <path d="M54 35L68 43V61L54 69L40 61V43L54 35Z" stroke="${color}" stroke-width="2" fill="none"/>
  <path d="M54 35V52M54 52L40 61M54 52L68 61" stroke="${color}" stroke-width="1.5" opacity="0.5"/>
  <text x="54" y="90" font-family="system-ui, -apple-system" font-size="9" fill="#888" text-anchor="middle">${label:0:14}</text>
</svg>
SVGEOF
done

# Convert SVG to PNG placeholders (rename .png.svg to .png for now as placeholder)
for model in "${models[@]}"; do
  mv "${model}.png.svg" "${model}.png" 2>/dev/null || true
done

echo "Created thumbnails for ${#models[@]} models"
