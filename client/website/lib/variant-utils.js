/**
 * Shared helpers for resolving product model/variant images, labels, and pricing
 * across PDP, QuickView, and ProductCard components.
 */

export function hasProductModelVariants(product) {
  return Boolean(
    product &&
      Array.isArray(product.variants) &&
      product.variants.some((v) => v && v.model_name && String(v.model_name).trim() !== '')
  );
}

export function resolveVariantImage(variant, product) {
  const fallback =
    product?.primary_image ||
    (product?.gallery && product.gallery[0]) ||
    (product?.images && product.images[0]) ||
    (product?.colors && (product.colors[0]?.img || product.colors[0]?.image_url)) ||
    product?.image ||
    '/assets/brand-logo.png';

  if (!variant) return fallback;

  if (variant.image_url && String(variant.image_url).trim() !== '') {
    return String(variant.image_url).trim();
  }

  const mName = variant.model_name ? String(variant.model_name).trim().toLowerCase() : '';
  const cName = variant.color_name ? String(variant.color_name).trim().toLowerCase() : '';

  if (Array.isArray(product?.images_detailed)) {
    const detailMatch = product.images_detailed.find((img) => {
      if (!img?.image_url || !img?.color_name) return false;
      const imgKey = String(img.color_name).trim().toLowerCase();
      if (mName && imgKey === mName) return true;
      if (cName && cName !== 'standard' && imgKey === cName) return true;
      return false;
    });
    if (detailMatch) return detailMatch.image_url;
  }

  if (cName && cName !== 'standard' && Array.isArray(product?.colors)) {
    const colorMatch = product.colors.find(
      (c) => c?.name && String(c.name).trim().toLowerCase() === cName && (c.img || c.image_url)
    );
    if (colorMatch) return colorMatch.img || colorMatch.image_url;
  }

  return fallback;
}

export function getVariantDisplayLabel(variant, idx = 0) {
  if (!variant) return `Model #${idx + 1}`;
  if (variant.model_name && String(variant.model_name).trim() !== '') {
    return String(variant.model_name).trim();
  }
  if (variant.color_name && !/^standard$/i.test(String(variant.color_name).trim())) {
    return String(variant.color_name).trim();
  }
  if (variant.size_name && !/^(standard|one size)$/i.test(String(variant.size_name).trim())) {
    return String(variant.size_name).trim();
  }
  return `Model #${idx + 1}`;
}

export function getVariantSubLabel(variant) {
  if (!variant) return '';
  const parts = [];
  const mName = variant.model_name ? String(variant.model_name).trim() : '';
  const cName = variant.color_name ? String(variant.color_name).trim() : '';
  const sName = variant.size_name ? String(variant.size_name).trim() : '';

  if (cName && !/^standard$/i.test(cName) && cName.toLowerCase() !== mName.toLowerCase()) {
    parts.push(cName);
  }
  if (sName && !/^(standard|one size)$/i.test(sName) && sName.toLowerCase() !== mName.toLowerCase()) {
    parts.push(sName);
  }
  return parts.join(' · ');
}

export function getVariantPricing(variant, product) {
  const rawPrice =
    variant?.price !== null && variant?.price !== undefined && Number(variant.price) > 0
      ? parseFloat(variant.price)
      : typeof product?.price === 'number'
      ? product.price
      : parseFloat(product?.price || 0);

  const rawSalePrice =
    variant?.sale_price !== null && variant?.sale_price !== undefined && Number(variant.sale_price) > 0
      ? parseFloat(variant.sale_price)
      : typeof product?.sale_price === 'number'
      ? product.sale_price
      : parseFloat(product?.sale_price || 0);

  const mrp =
    variant?.mrp !== null && variant?.mrp !== undefined && Number(variant.mrp) > 0
      ? parseFloat(variant.mrp)
      : typeof product?.mrp === 'number'
      ? product.mrp
      : parseFloat(product?.mrp || 0);

  const hasSale = rawSalePrice > 0 && rawSalePrice < rawPrice;
  const unitPrice = hasSale ? rawSalePrice : rawSalePrice > 0 && rawPrice === 0 ? rawSalePrice : rawPrice;

  return { price: rawPrice, salePrice: rawSalePrice, mrp, hasSale, unitPrice };
}

/**
 * Expands products that have model_name variants into individual card items
 * with "Product Title - Model Name" and the variant's respective image & pricing.
 * Products without model_name variants remain as a single card.
 */
export function expandProductsByModel(products = []) {
  if (!Array.isArray(products)) return [];
  const expanded = [];

  for (const p of products) {
    if (!p) continue;
    if (hasProductModelVariants(p)) {
      const variants = p.variants || [];
      variants.forEach((v, vIdx) => {
        const vLabel = getVariantDisplayLabel(v, vIdx);
        const vImg = resolveVariantImage(v, p);
        const vPricing = getVariantPricing(v, p);
        const cleanTitle = String(p.name || '').trim();
        expanded.push({
          ...p,
          _cardKey: `${p.id}__v_${v.id ?? vIdx}`,
          _preselectedVariant: v,
          _modelLabel: vLabel,
          _baseProductName: cleanTitle,
          name: vLabel ? `${cleanTitle} - ${vLabel}` : cleanTitle,
          primary_image: vImg,
          image: vImg,
          price: vPricing.price,
          sale_price: vPricing.salePrice,
          mrp: vPricing.mrp
        });
      });
    } else {
      expanded.push({
        ...p,
        _cardKey: p.id
      });
    }
  }

  return expanded;
}
