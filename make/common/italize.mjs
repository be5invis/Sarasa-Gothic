export const italize = function (b, degrees) {
	for (let g in b.glyf) {
		if (!b.glyf[g] || !b.glyf[g].contours) continue;
		const glyph = b.glyf[g];
		for (let c of glyph.contours)
			for (let z of c) {
				const slope = Math.tan((degrees / 180) * Math.PI);
				z.x += z.y * slope - (b.head.unitsPerEm / 3) * slope;
			}
	}
};
