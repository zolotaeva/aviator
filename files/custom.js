	(function () {
		var STATUS_LABEL = {
			free: 'Свободен',
			sold: 'Продан',
			reserved: 'Бронь',
			infra: 'Инфраструктура'
		};

		var svg = document.querySelector('.plot-map__svg');
		var tooltip = document.getElementById('plotTooltip');
		var modal = document.getElementById('plotModal');
		var modalCallback = document.getElementById('callbackModal');
		var isTouch = window.matchMedia('(hover: none)').matches;

		// Номера участков: считаем цент полигона и ставим <text> ----
		// Не храним координаты подписи вручную — она всегда сама попадёт
		// в центр фигуры, даже если вы поменяете точки полигона.
		var svgNS = 'http://www.w3.org/2000/svg';
		var labelsGroup = document.createElementNS(svgNS, 'g');
		labelsGroup.setAttribute('class', 'plot-labels');
		svg.appendChild(labelsGroup);
 
		function polygonCentroid(pointsStr) {
			var pts = pointsStr.trim().split(/\s+/).map(function (pair) {
				var xy = pair.split(',');
				return [parseFloat(xy[0]), parseFloat(xy[1])];
			});
			var sx = 0, sy = 0;
			pts.forEach(function (p) { sx += p[0]; sy += p[1]; });
			return { center: [sx / pts.length, sy / pts.length], pts: pts };
		}
 
		// Угол участка — берём САМУЮ ДЛИННУЮ сторону полигона вдоль неё и должна читаться подпись
		function polygonAngle(pts) {
			var bestLen = 0, bestAngle = 0;
			for (var i = 0; i < pts.length; i++) {
				var p1 = pts[i], p2 = pts[(i + 1) % pts.length];
				var dx = p2[0] - p1[0], dy = p2[1] - p1[1];
				var len = Math.hypot(dx, dy);
				if (len > bestLen) {
					bestLen = len;
					bestAngle = Math.atan2(dy, dx) * 180 / Math.PI;
				}
			}
			// нормализуем в диапазон -90..90, чтобы текст не оказался "вверх ногами"
			if (bestAngle > 90) bestAngle -= 180;
			if (bestAngle < -90) bestAngle += 180;
			return bestAngle;
		}
 
		document.querySelectorAll('.plot').forEach(function (plot) {
			if (plot.dataset.status === 'infra') {
				// ---- Иконка по умолчанию для инфраструктуры ----
				// <use> ссылается на один <symbol> в <defs> — сама иконка
				// не дублируется в разметке на каждый участок, только ссылка
				var poly = polygonCentroid(plot.getAttribute('points'));
				var iconW = 22, iconH = 32; // пропорции 34:50 из исходного SVG
				var use = document.createElementNS(svgNS, 'use');
				use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#infra-pin-icon');
				use.setAttribute('href', '#infra-pin-icon');
				// "носик" пина (нижняя точка) должен указывать точно в центр участка
				use.setAttribute('x', poly.center[0] - iconW / 2);
				use.setAttribute('y', poly.center[1] - iconH);
				use.setAttribute('width', iconW);
				use.setAttribute('height', iconH);
				use.setAttribute('class', 'plot-infra-icon');
				labelsGroup.appendChild(use);
				return; // у инфраструктуры номер не нужен
			}





			if (plot.dataset.status === 'sold') return; // у занятых участков номер не нужен
			var poly = polygonCentroid(plot.getAttribute('points'));
			var angle = polygonAngle(poly.pts);
			var text = document.createElementNS(svgNS, 'text');
			text.setAttribute('x', poly.center[0]);
			text.setAttribute('y', poly.center[1]);
			text.setAttribute('transform', 'rotate(' + angle + ' ' + poly.center[0] + ' ' + poly.center[1] + ')');
			text.setAttribute('class', 'plot-label');
			text.textContent = plot.dataset.id;
			labelsGroup.appendChild(text);
		});

		// ---- Тултип (только на устройствах с полноценным hover) ----
		if (!isTouch) {
			svg.addEventListener('pointermove', function (e) {
				var plot = e.target.closest('.plot');
				if (!plot) {
					tooltip.classList.remove('is-visible');
					return;
				}
				if (plot.dataset.status == 'infra') {
					tooltip.textContent = plot.dataset.name;
				} else if (plot.dataset.status == 'sold') {
					tooltip.textContent = STATUS_LABEL[plot.dataset.status];
				} else {
					tooltip.textContent = plot.dataset.name + ' — ' + STATUS_LABEL[plot.dataset.status];
				}

				tooltip.style.left = e.clientX + 'px';
				tooltip.style.top = e.clientY + 'px';
				tooltip.classList.add('is-visible');
			});
			svg.addEventListener('pointerleave', function () {
				tooltip.classList.remove('is-visible');
			});
		}

		// ---- Клик — один обработчик на весь SVG (делегирование) ----
		svg.addEventListener('click', function (e) {
			var plot = e.target.closest('.plot');
			if (!plot || plot.dataset.status === 'infra') return;
			openModal(plot);
		});

		function openModal(plot) {
			document.getElementById('modalTop').textContent = "1 очередь продаж";
			document.getElementById('modalTop').dataset.status = plot.dataset.status;
			document.getElementById('modalTitle').textContent = plot.dataset.name;
			if (plot.dataset.area) {
				document.getElementById('modalArea').innerHTML = `Площадь: <span>${plot.dataset.area} кв.м.</span>`;
			}
    
			document.getElementById('modalStatus').innerHTML = `Статус: <span class="${plot.dataset.status}">${STATUS_LABEL[plot.dataset.status]}</span>`;
			if (plot.dataset.price1) {
				document.getElementById('modalPrice1').innerHTML = `Стоимость по рынку 1 сот.: <span>${plot.dataset.price1}</span>`;
			}
			if (plot.dataset.cadastr) {
				document.getElementById('modalCadastr').innerHTML = `Кадастровый номер: <span>${plot.dataset.cadastr}</span>`;
			}
			if (plot.dataset.price) {
				document.getElementById('modalPrice').textContent = `${plot.dataset.price} рублей`;
			}
			var cta = document.getElementById('modalCta');
			if (plot.dataset.status === 'sold') {
				cta.style.display = 'none';
			} else {
				cta.style.display = 'block';
				cta.onclick = function () {
					modalCallback.classList.add('is-open');
					//alert('Заявка по участку ' + plot.dataset.id);
				};
			}
			modal.classList.add('is-open');
		}

		document.getElementById('plotModalClose').addEventListener('click', closeModal);

		document.getElementById('callbackModalClose').addEventListener('click', () => {
			modalCallback.classList.remove('is-open');
			modal.classList.remove('is-open');
		});

		modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
		document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

		function closeModal() { modal.classList.remove('is-open'); }
})();
	

document.addEventListener("DOMContentLoaded", () => {

	const gallerySwiper = new Swiper(".gallery__slider", {
		loop: false,
		spaceBetween: 30,
		centeredSlides: true,
		slidesPerView: 4.5,
		touchRatio: 1,
		resistanceRatio: 0.85,
		centeredSlidesBounds: true,
		loopAdditionalSlides: 3,
		observer: true,
		observeParents: true,
		watchSlidesProgress: true,
		grabCursor: true,
		breakpoints: {
		320: {
			slidesPerView: 2.5,
			spaceBetween: 20,
		},
		767: {
			slidesPerView: 3.5,
			loopAdditionalSlides: 2,
		},
		992: {
			slidesPerView: 4.5,
		},
					
	},
	});

	const territoryThumbs = new Swiper('.av-territory__thumb', {
		freeMode: true,
		slidesPerView: 1,
		loop: true,
	
	});

	const territorySlider = new Swiper('.av-territory__slider', {
		slidesPerView: 1,
		effect:'fade',
		loop: true,
		thumbs: {
			swiper: territoryThumbs,
		},
		pagination: {
			el: '.av-territory__nav .pagination',
		},
		navigation: {
			nextEl: '.av-territory__nav .btn-next',
			prevEl: '.av-territory__nav .btn-prev',
		},
	});

	const partnersThumbs = new Swiper('.partners__slider', {
		freeMode: true,
		slidesPerView: 4,
		loop: true,
		spaceBetween: 30,
	
	});

});