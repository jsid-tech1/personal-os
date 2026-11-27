(function () {
  'use strict';

  /* Theme toggle with localStorage persistence */
  var root = document.documentElement;
  var themeToggle = document.getElementById('theme-toggle');

  function updateThemeButton(theme) {
    if (!themeToggle) return;
    var isDark = theme === 'dark';
    themeToggle.setAttribute('aria-pressed', String(isDark));
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  updateThemeButton(root.getAttribute('data-theme') || 'light');

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      updateThemeButton(next);
      try {
        localStorage.setItem('personal-os-theme', next);
      } catch (e) {
        /* Ignore storage errors */
      }
    });
  }

  /* Section entrance reveal */
  var revealEls = document.querySelectorAll('[data-reveal]');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) {
      el.classList.add('is-visible');
    });
  } else {
    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealEls.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* Hero mini botanical mosaic (static representation of 9 completed tasks) */
  var heroMosaicEl = document.getElementById('hero-mosaic');
  var heroLayout = [
    0, 0, 0, 0, 4, 0, 0, 0, 0,
    0, 0, 0, 4, 3, 4, 0, 0, 0,
    0, 0, 0, 0, 1, 0, 0, 0, 0,
    0, 2, 1, 0, 1, 0, 3, 2, 0,
    0, 0, 2, 1, 1, 1, 2, 0, 0,
    0, 0, 0, 0, 1, 0, 0, 0, 0,
    0, 0, 2, 1, 1, 0, 0, 0, 0,
    0, 0, 0, 0, 1, 1, 2, 0, 0,
    0, 0, 0, 0, 1, 0, 0, 0, 0
  ];
  var toneClass = {
    1: 'tone-forest',
    2: 'tone-sage',
    3: 'tone-chartreuse',
    4: 'tone-raspberry'
  };

  if (heroMosaicEl) {
    var heroFrag = document.createDocumentFragment();
    heroLayout.forEach(function (cell, idx) {
      var sq = document.createElement('span');
      sq.className = 'mosaic-cell';
      if (cell > 0) {
        /* Reveal 9 tiles to match a mid-week state, leaving remaining structural slots empty */
        var revealedIndices = [4, 13, 22, 31, 40, 49, 58, 67, 76];
        if (revealedIndices.indexOf(idx) !== -1) {
          sq.classList.add(toneClass[cell]);
        } else {
          sq.classList.add('is-slot');
        }
      }
      heroFrag.appendChild(sq);
    });
    heroMosaicEl.appendChild(heroFrag);
  }

  /* Interactive Mosaic Demo (13 x 11 grid with 24 botanical slots) */
  var demoMosaicEl = document.getElementById('demo-mosaic');
  var demoBtn = document.getElementById('mosaic-demo-btn');
  var resetBtn = document.getElementById('mosaic-reset-btn');
  var statusEl = document.getElementById('mosaic-status');
  var counterEl = document.getElementById('mosaic-counter');

  /* 
    0 = background space
    1 = forest stem/leaf
    2 = sage leaf
    3 = chartreuse bud
    4 = raspberry blossom
  */
  var demoMatrix = [
    0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 4, 3, 4, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 2, 1, 0, 1, 0, 1, 2, 0, 0, 0,
    0, 0, 0, 0, 2, 1, 1, 1, 2, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 3, 1, 1, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 1, 1, 3, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0
  ];

  /* Collect all botanical slot coordinates in bottom-up growth order */
  var botanicalSlots = [];
  for (var row = 10; row >= 0; row--) {
    for (var col = 0; col < 13; col++) {
      var matrixIndex = row * 13 + col;
      if (demoMatrix[matrixIndex] > 0) {
        botanicalSlots.push({
          index: matrixIndex,
          tone: toneClass[demoMatrix[matrixIndex]]
        });
      }
    }
  }

  var exampleTasks = [
    'Photograph ceramic test tiles (20m)',
    'Trim bibliography for studio seminar (15m)',
    'Export final SVG icons for client deck (25m)',
    'Write two paragraphs for residency application (30m)',
    'Sort archival prints by project date (20m)',
    'Prepare critique pin-up notes (15m)',
    'Archive raw audio stems from field recording (20m)',
    'Verify print margins on proof copy (15m)',
    'Reply to gallery coordinator with dimensions (10m)',
    'Clean palette and label pigment jars (15m)',
    'Package portfolio PDF under 12MB (20m)',
    'Sketch homepage wireframes in notebook (30m)',
    'Label shipping tube for framed print (10m)',
    'Close out Friday studio notes (15m)'
  ];

  var initialCount = 10;
  var revealedCount = initialCount;
  var totalSlots = botanicalSlots.length;
  var cellNodes = [];

  if (demoMosaicEl) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < demoMatrix.length; i++) {
      var cell = document.createElement('span');
      cell.className = 'mosaic-cell';
      if (demoMatrix[i] > 0) {
        cell.classList.add('is-slot');
      }
      cellNodes.push(cell);
      frag.appendChild(cell);
    }
    demoMosaicEl.appendChild(frag);
  }

  function renderDemo(justCompletedTask) {
    botanicalSlots.forEach(function (slot, idx) {
      var node = cellNodes[slot.index];
      if (!node) return;
      node.classList.remove('tone-forest', 'tone-sage', 'tone-chartreuse', 'tone-raspberry');
      if (idx < revealedCount) {
        node.classList.add(slot.tone);
      }
    });

    if (counterEl) {
      counterEl.textContent = revealedCount + ' / ' + totalSlots + ' tiles';
    }

    if (demoMosaicEl) {
      demoMosaicEl.setAttribute(
        'aria-label',
        'Interactive botanical pixel mosaic with ' + revealedCount + ' of ' + totalSlots + ' tiles revealed'
      );
    }

    var taskIndex = revealedCount - initialCount;
    var nextTask = exampleTasks[taskIndex];

    if (revealedCount >= totalSlots) {
      if (demoBtn) {
        demoBtn.disabled = true;
        demoBtn.textContent = 'Canvas complete';
      }
      if (resetBtn) {
        resetBtn.hidden = false;
      }
      if (statusEl) {
        statusEl.textContent = totalSlots + ' of ' + totalSlots + ' tiles revealed. This week\'s botanical composition is complete.';
      }
    } else {
      if (demoBtn) {
        demoBtn.disabled = false;
        demoBtn.textContent = 'Complete an example task';
      }
      if (resetBtn) {
        resetBtn.hidden = revealedCount === initialCount;
      }
      if (statusEl) {
        if (justCompletedTask) {
          statusEl.textContent = revealedCount + ' of ' + totalSlots + ' tiles revealed. Finished: ' + justCompletedTask + '.';
        } else {
          statusEl.textContent = revealedCount + ' of ' + totalSlots + ' tiles revealed this week. Next: ' + nextTask + '.';
        }
      }
    }
  }

  renderDemo(null);

  if (demoBtn) {
    demoBtn.addEventListener('click', function () {
      if (revealedCount >= totalSlots) return;
      var taskIndex = revealedCount - initialCount;
      var finishedTask = exampleTasks[taskIndex] || 'Example task finished';
      revealedCount += 1;
      renderDemo(finishedTask);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      revealedCount = initialCount;
      renderDemo(null);
    });
  }
})();