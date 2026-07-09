# Fonts Directory

Place your `.otf` font files in this directory.

## Usage

After placing your font files here, update the `@font-face` declarations in `src/styles/global.css` to reference your font files.

### Example:

If you have a font file named `MyFont-Regular.otf`:

```css
@font-face {
  font-family: 'CustomSans';
  src: url('/fonts/MyFont-Regular.otf') format('opentype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

### Multiple Weights

If you have multiple font weights, add separate `@font-face` declarations for each:

```css
/* Regular weight */
@font-face {
  font-family: 'CustomSans';
  src: url('/fonts/MyFont-Regular.otf') format('opentype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

/* Bold weight */
@font-face {
  font-family: 'CustomSans';
  src: url('/fonts/MyFont-Bold.otf') format('opentype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

### Font Weight Values

Common font-weight values:
- 300: Light
- 400: Regular/Normal
- 500: Medium
- 600: Semi-bold
- 700: Bold
- 800: Extra-bold

