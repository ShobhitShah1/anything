export const BrandMark = () => {
  const mask = `url("${import.meta.env.BASE_URL}anything-mark.png?v=folded-a-1")`;
  return (
    <span className="brand-glass" aria-hidden="true">
      <span className="brand-glyph" style={{ maskImage: mask, WebkitMaskImage: mask }} />
    </span>
  );
};
