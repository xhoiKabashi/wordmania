/* ============================================================
   FJALËMANIA LIVE — PixiJS 60fps Multi-Frame PNG Mascot Animator
   Supports switching between two full 6-frame illustrated mascots:
   - 'cat': Macja Shqiptare (/art/mascot-idle.png .. /art/mascot-wink.png)
   - 'dog': Qeni Shqiptar   (/art/dog-idle.png    .. /art/dog-wink.png)
   Uses a single 100%-opaque PIXI.Sprite with pre-decoded PNG textures
   so expression & character changes never drop opacity or flash dark.
   ============================================================ */
(function () {
  'use strict';

  const W = 300;
  const H = 258;

  const CHARACTER_SETS = {
    cat: {
      idle: '/art/mascot-idle.png',
      blink: '/art/mascot-blink.png',
      talk: '/art/mascot-talk.png',
      cheer: '/art/mascot-cheer.png',
      gold: '/art/mascot-gold.png',
      wink: '/art/mascot-wink.png'
    },
    dog: {
      idle: '/art/dog-idle.png',
      blink: '/art/dog-blink.png',
      talk: '/art/dog-talk.png',
      cheer: '/art/dog-cheer.png',
      gold: '/art/dog-gold.png',
      wink: '/art/dog-wink.png'
    }
  };

  function makeRayTexture(points) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">
      <defs>
        <linearGradient id="gRay" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff3b0"/>
          <stop offset="0.55" stop-color="#f5be3b"/>
          <stop offset="1" stop-color="#c27d12"/>
        </linearGradient>
      </defs>
      <polygon points="${points}" fill="url(#gRay)" stroke="#182436" stroke-width="3.2" stroke-linejoin="round"/>
    </svg>`;
    return window.PIXI.Texture.from('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  }

  function createMascotPixi(hostEl) {
    if (!hostEl || !window.PIXI) return null;

    let app;
    try {
      app = new window.PIXI.Application({
        width: W,
        height: H,
        backgroundAlpha: 0,
        antialias: true,
        resolution: 2,
        autoDensity: true
      });
    } catch {
      return null;
    }

    const view = app.view;
    view.className = 'mascot-canvas';
    view.setAttribute('aria-hidden', 'true');
    hostEl.appendChild(view);

    const anchorX = 141;
    const anchorY = 250;
    const charW = 217;
    const charH = 250;

    const root = new window.PIXI.Container();
    root.pivot.set(anchorX, anchorY);
    root.position.set(anchorX, anchorY);
    app.stage.addChild(root);

    const charBox = new window.PIXI.Container();
    charBox.pivot.set(anchorX, anchorY);
    charBox.position.set(anchorX, anchorY);
    root.addChild(charBox);

    const textures = { cat: {}, dog: {} };
    const ready = { cat: {}, dog: {} };
    const charSprite = new window.PIXI.Sprite(window.PIXI.Texture.EMPTY);
    charSprite.anchor.set(0.5, 1.0);
    charSprite.position.set(anchorX, anchorY);
    charSprite.width = charW;
    charSprite.height = charH;
    charSprite.alpha = 1;
    charBox.addChild(charSprite);

    let currentChar = 'cat';
    let activeSignature = '';

    Object.keys(CHARACTER_SETS).forEach((charName) => {
      const urls = CHARACTER_SETS[charName];
      Object.keys(urls).forEach((key) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          const finalize = () => {
            const tex = window.PIXI.Texture.from(img);
            textures[charName][key] = tex;
            ready[charName][key] = true;
            if (
              charName === currentChar &&
              key === 'idle' &&
              charSprite.texture === window.PIXI.Texture.EMPTY
            ) {
              charSprite.texture = tex;
              charSprite.width = charW;
              charSprite.height = charH;
              activeSignature = `${charName}:idle`;
              hostEl.classList.add('pixi-ready');
            }
          };
          if (typeof img.decode === 'function') {
            img.decode().then(finalize).catch(finalize);
          } else {
            finalize();
          }
        };
        img.src = urls[key];
      });
    });

    // 3 Golden Comic Action Rays
    const raySpecs = [
      { pts: '235,45 266,18 275,32 243,53', px: 239, py: 48 },
      { pts: '247,66 285,56 288,70 250,77', px: 249, py: 71 },
      { pts: '245,89 281,89 279,103 244,98', px: 245, py: 94 }
    ];
    const rays = raySpecs.map((spec) => {
      const sp = new window.PIXI.Sprite(makeRayTexture(spec.pts));
      sp.pivot.set(spec.px, spec.py);
      sp.position.set(spec.px, spec.py);
      root.addChild(sp);
      return sp;
    });

    /* -----------------------------------------------------------
       ANIMATION & EXPRESSION STATE MACHINE (60 FPS, ZERO FLASH)
       ----------------------------------------------------------- */
    const anim = {
      t: 0,
      mode: 'idle', // idle | found | gold | gift | like | hint
      modeUntil: 0,
      talkUntil: 0,
      blinkTimer: 3.4,
      isBlinking: false,
      jumpY: 0,
      jumpVel: 0,
      squash: 0,
      squashVel: 0
    };

    function pickTargetFrame(now) {
      const talking = now < anim.talkUntil;

      if (anim.mode === 'gold') return 'gold';
      if (anim.mode === 'found') return 'cheer';
      if (anim.mode === 'gift' || anim.mode === 'like' || anim.mode === 'hint') return 'wink';

      if (talking) {
        const mouthOpen = Math.floor(anim.t * 5.5) % 2 === 0;
        return mouthOpen ? 'talk' : 'idle';
      }

      if (anim.isBlinking) return 'blink';
      return 'idle';
    }

    app.ticker.add((delta) => {
      const dt = Math.min(0.05, delta / 60);
      anim.t += dt;
      const now = performance.now();

      if (anim.mode !== 'idle' && now > anim.modeUntil) {
        anim.mode = 'idle';
      }

      // Natural idle blink timer
      anim.blinkTimer -= dt;
      if (anim.blinkTimer <= 0) {
        if (!anim.isBlinking) {
          anim.isBlinking = true;
          anim.blinkTimer = 0.13;
        } else {
          anim.isBlinking = false;
          anim.blinkTimer = 3.2 + Math.random() * 2.8;
        }
      }

      // Swap texture on the single opaque sprite (alpha stays 1.0 always -> zero black flash)
      const desired = pickTargetFrame(now);
      const charReady = ready[currentChar] || ready.cat;
      const charTextures = textures[currentChar] || textures.cat;
      const nextKey = charReady[desired] ? desired : 'idle';
      const sig = `${currentChar}:${nextKey}`;
      if (sig !== activeSignature && charReady[nextKey]) {
        activeSignature = sig;
        charSprite.texture = charTextures[nextKey];
        charSprite.width = charW;
        charSprite.height = charH;
      }

      // Jump & landing squash-and-stretch physics
      if (anim.jumpY < 0 || anim.jumpVel !== 0) {
        anim.jumpY += anim.jumpVel * dt * 60;
        anim.jumpVel += 1.35 * dt * 60;
        if (anim.jumpY >= 0) {
          anim.jumpY = 0;
          anim.jumpVel = 0;
          anim.squashVel = -0.038;
        }
      }

      anim.squashVel += -anim.squash * 0.28;
      anim.squashVel *= 0.76;
      anim.squash += anim.squashVel;

      const excited = anim.mode !== 'idle';
      const talking = now < anim.talkUntil;
      const breathFreq = excited ? 6.5 : talking ? 4.8 : 2.2;
      const breath = Math.sin(anim.t * breathFreq);
      const sway = Math.sin(anim.t * (excited ? 4.2 : 1.3));

      const scaleX = 1 - breath * (excited ? 0.015 : 0.008) - anim.squash;
      const scaleY = 1 + breath * (excited ? 0.018 : 0.01) + anim.squash;

      charBox.scale.set(scaleX, scaleY);
      charBox.position.y = anchorY + anim.jumpY;
      charBox.rotation = sway * (excited ? 0.038 : talking ? 0.022 : 0.012);

      // Animate the 3 Golden Comic Action Rays
      const rayBase = excited ? 1.1 : talking ? 1.02 : 0.88;
      rays.forEach((r, idx) => {
        const wave = Math.sin(anim.t * (excited ? 10 : talking ? 7 : 3.4) - idx * 0.85);
        const s = rayBase + wave * (excited || talking ? 0.12 : 0.04);
        r.scale.set(s, s);
        r.rotation = wave * (excited ? 0.08 : 0.03);
        r.position.y = raySpecs[idx].py + anim.jumpY * 0.85;
      });
    });

    function react(mode) {
      const now = performance.now();
      anim.mode = mode || 'found';
      anim.modeUntil = now + (mode === 'gold' ? 3000 : 2200);
      anim.talkUntil = now + 1500;
      anim.jumpVel = mode === 'gold' ? -6.8 : mode === 'found' ? -5.4 : -4.0;
      anim.squashVel = 0.04;
    }

    function speak(durationMs = 1200) {
      const now = performance.now();
      anim.talkUntil = Math.max(anim.talkUntil, now + durationMs);
      if (anim.jumpY === 0) {
        anim.squashVel = 0.02;
      }
    }

    function setCharacter(charType) {
      const next = charType === 'dog' ? 'dog' : 'cat';
      if (next === currentChar) return;
      currentChar = next;
      activeSignature = '';
      react('found');
    }

    return { react, speak, setCharacter, app };
  }

  window.initMascotPixi = createMascotPixi;
})();
