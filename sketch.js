// =============================================
//  電流急急棒  Wire Buzz Game  v2
// =============================================
let W, H;
const RING_R = 13;

// ---- 難度 ----
const DIFFS = {
  easy:   { label:'簡單', minGap:40, maxGap:58, color:'#00ff88' },
  normal: { label:'普通', minGap:28, maxGap:40, color:'#ffdd00' },
  hard:   { label:'困難', minGap:18, maxGap:28, color:'#ff6600' },
  expert: { label:'地獄', minGap:12, maxGap:19, color:'#ff0044' },
};
const DIFF_KEYS = ['easy','normal','hard','expert'];

// ---- 關卡定義（5關，每關獨立路徑） ----
// centerYs: 8個點的中心Y比例（0=頂, 1=底，基準=0.5）
const STAGE_DEFS = [
  {
    name:'訓練場', shape:'平緩波浪',
    bg:'#070f07', wc:'#00ff88', ac:'#00ffcc',
    // 正弦波：緩慢上下起伏
    path: [0.50, 0.38, 0.30, 0.42, 0.58, 0.68, 0.60, 0.50],
  },
  {
    name:'工廠', shape:'Z字鋸齒',
    bg:'#0f0a00', wc:'#ffcc00', ac:'#ff9900',
    // 大幅上下交錯
    path: [0.50, 0.25, 0.72, 0.25, 0.72, 0.25, 0.72, 0.50],
  },
  {
    name:'熔爐', shape:'急升急降',
    bg:'#0f0000', wc:'#ff4400', ac:'#ff2200',
    // 階梯：陡上→平台→陡下→平台
    path: [0.50, 0.50, 0.22, 0.22, 0.76, 0.76, 0.50, 0.50],
  },
  {
    name:'量子迷宮', shape:'大S彎道',
    bg:'#00000f', wc:'#aa00ff', ac:'#ff00ff',
    // S形：上弧→下弧
    path: [0.50, 0.30, 0.20, 0.35, 0.65, 0.80, 0.70, 0.50],
  },
  {
    name:'終極試煉', shape:'複合迷陣',
    bg:'#050505', wc:'#ffffff', ac:'#ff0055',
    // 波浪+鋸齒混合
    path: [0.50, 0.28, 0.65, 0.20, 0.75, 0.30, 0.68, 0.50],
  },
];

// ---- 狀態 ----
let state = 'MENU';   // MENU | DIFF | PLAYING | SUCCESS | FAIL
let diffKey  = 'normal';
let stageIdx = 0;
let lives    = 3;
let score    = 0;
let timer    = 0;

// ---- 導線 ----
let topPts = [], botPts = [];   // [{x,y}] 長度8
let ringX, ringY;
let started = false;

// ---- 特效 ----
let particles = [];
let flash = 0, flashCol = [255,0,0];
let shake = 0;
let pulse = 0;
let bestTimes = {};

// ---- 按鈕快取 ----
let btns = {};

// =============================================
function setup() {
  W = windowWidth;
  H = windowHeight;
  createCanvas(W, H);
  textFont('Courier New');
  noCursor();
  buildWire();
  placeRing();
}

function windowResized() {
  W = windowWidth;
  H = windowHeight;
  resizeCanvas(W, H);
  // 視窗大小改變時重新生成導線與重置環圈位置，避免超出邊界
  buildWire();
  placeRing();
}

// =============================================
function draw() {
  // shake offset
  let ox = 0, oy = 0;
  if (shake > 0) {
    ox = random(-shake, shake);
    oy = random(-shake, shake);
    shake *= 0.82;
    if (shake < 0.4) shake = 0;
  }
  translate(ox, oy);

  let stg = curStage();
  background(stg.bg);
  drawGrid(stg);

  // flash overlay
  if (flash > 0) {
    noStroke();
    fill(flashCol[0], flashCol[1], flashCol[2], map(flash,0,22,0,110));
    rect(-ox,-oy,W,H);
    flash--;
  }

  pulse += 0.045;

  if      (state === 'MENU')    drawMenu();
  else if (state === 'DIFF')    drawDiffSelect();
  else if (state === 'PLAYING') drawPlaying();
  else if (state === 'SUCCESS') drawSuccess();
  else if (state === 'FAIL')    drawFail();

  // 自訂游標（霓虹十字）
  drawCursor();
}

// =============================================
// 工具
function curStage() { return STAGE_DEFS[stageIdx % STAGE_DEFS.length]; }
function curDiff()  { return DIFFS[diffKey]; }

// =============================================
// 建立導線
// =============================================
function buildWire() {
  let stg  = curStage();
  let diff = curDiff();
  topPts = []; botPts = [];

  let n = 8;
  let xStart = 90, xEnd = W - 90;
  let seg = (xEnd - xStart) / (n - 1);

  // 關卡2（工廠鋸齒）X微偏移讓鋸齒更尖
  let xOffsets = (stageIdx % STAGE_DEFS.length === 1)
    ? [0, -10, 10, -10, 10, -10, 10, 0]
    : new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    let cx = xStart + seg * i + xOffsets[i];
    let cyRatio = stg.path[i];
    let cy = 60 + cyRatio * (H - 120);   // Y 在 60~460 之間映射

    // 端點間距較寬方便進出
    let gapMax = (i === 0 || i === n-1) ? diff.maxGap * 1.15 : diff.maxGap;
    let gapMin = (i === 0 || i === n-1) ? diff.minGap * 1.15 : diff.minGap;
    // 中段依關卡縮窄
    let narrow = [1.0, 0.88, 0.78, 0.83, 0.72][stageIdx % 5];
    if (i > 1 && i < n-2) { gapMin *= narrow; gapMax *= narrow; }

    let gap = random(gapMin, gapMax);
    topPts.push({ x: cx, y: cy - gap });
    botPts.push({ x: cx, y: cy + gap });
  }
}

function placeRing() {
  ringX   = topPts[0].x;
  ringY   = (topPts[0].y + botPts[0].y) / 2;
  started = false;
  timer   = 0;
}

// =============================================
// 導線繪製（vertex 折線 + 光暈）
// =============================================
function drawWire() {
  let stg = curStage();
  let wc  = color(stg.wc);

  for (let pass = 0; pass < 3; pass++) {
    if (pass === 0) { stroke(red(wc),green(wc),blue(wc), 18); strokeWeight(18); }
    else if (pass === 1) { stroke(red(wc),green(wc),blue(wc), 55); strokeWeight(7); }
    else { stroke(wc); strokeWeight(2.5); }
    noFill();

    // 上線 — 用 vertex（折線）加兩端延伸點
    beginShape();
    vertex(topPts[0].x - 30, topPts[0].y);
    for (let p of topPts) vertex(p.x, p.y);
    vertex(topPts[topPts.length-1].x + 30, topPts[topPts.length-1].y);
    endShape();

    // 下線
    beginShape();
    vertex(botPts[0].x - 30, botPts[0].y);
    for (let p of botPts) vertex(p.x, p.y);
    vertex(botPts[botPts.length-1].x + 30, botPts[botPts.length-1].y);
    endShape();
  }

  // 起點 / 終點閘門
  drawGate(topPts[0], botPts[0], '起', stg.ac, true);
  drawGate(topPts[topPts.length-1], botPts[botPts.length-1], '終', stg.ac, false);

  // 電流流動粒子
  if (started) {
    let t  = (frameCount * 0.016) % 1;
    let ep = lerpWire(t);
    fill(255, 230, 60, 220); noStroke();
    ellipse(ep.x, ep.y, 6, 6);
    fill(255,255,255,120);
    ellipse(ep.x + random(-2,2), ep.y + random(-2,2), 3, 3);
  }
}

function drawGate(tp, bp, label, col, isStart) {
  let mx = tp.x, my = (tp.y + bp.y) / 2;
  let h  = abs(bp.y - tp.y) + 14;
  stroke(col); strokeWeight(2);
  fill(0, 0, 0, 200);
  rect(mx - 9, my - h/2, 18, h, 3);
  noStroke(); fill(col);
  textSize(9); textAlign(CENTER);
  text(label, mx, my + h/2 + 12);
}

// 取導線中心插值點
function lerpWire(t) {
  let n = topPts.length;
  let fi = t * (n - 1);
  let i  = constrain(floor(fi), 0, n - 2);
  let f  = fi - i;
  return {
    x: lerp(topPts[i].x, topPts[i+1].x, f),
    y: lerp((topPts[i].y+botPts[i].y)/2, (topPts[i+1].y+botPts[i+1].y)/2, f)
  };
}

// =============================================
// 碰撞 — 以最近線段的上下界判斷
// =============================================
function collision() {
  let best = Infinity, bi = 0, bt = 0;
  for (let i = 0; i < topPts.length-1; i++) {
    for (let s = 0; s <= 16; s++) {
      let t  = s / 16;
      let cx = lerp(topPts[i].x, topPts[i+1].x, t);
      let cy = lerp((topPts[i].y+botPts[i].y)/2,(topPts[i+1].y+botPts[i+1].y)/2, t);
      let d  = dist(ringX, ringY, cx, cy);
      if (d < best) { best = d; bi = i; bt = t; }
    }
  }
  let ty = lerp(topPts[bi].y, topPts[bi+1].y, bt);
  let by = lerp(botPts[bi].y, botPts[bi+1].y, bt);
  if (ringY - RING_R < ty) return true;
  if (ringY + RING_R > by) return true;
  if (ringX < topPts[0].x - 22 || ringX > topPts[topPts.length-1].x + 22) return true;
  return false;
}

function reachedEnd() {
  return ringX >= topPts[topPts.length-1].x - 8;
}

// =============================================
// 粒子
// =============================================
function boom(x, y, col) {
  for (let i = 0; i < 55; i++) {
    let a = random(TWO_PI), s = random(2,9);
    particles.push({ x, y, vx: cos(a)*s, vy: sin(a)*s, life:255, col, sz: random(3,8) });
  }
}

function confetti(x, y) {
  let cols = ['#00ff88','#ffdd00','#ff00ff','#00ccff','#ffffff','#ff6600'];
  for (let i = 0; i < 100; i++) {
    let a = random(TWO_PI), s = random(1,9);
    particles.push({ x: x+random(-30,30), y: y+random(-20,20),
      vx: cos(a)*s, vy: sin(a)*s - 3,
      life:255, col: random(cols), sz: random(4,11), grav: random(0.1,0.3) });
  }
}

function tickParticles() {
  for (let i = particles.length-1; i >= 0; i--) {
    let p = particles[i];
    p.x  += p.vx; p.y  += p.vy;
    p.vx *= 0.93; p.vy *= 0.93;
    if (p.grav) p.vy += p.grav;
    p.life -= 5;
    let c = color(p.col);
    noStroke(); fill(red(c),green(c),blue(c), p.life);
    ellipse(p.x, p.y, p.sz*(p.life/255));
    if (p.life <= 0) particles.splice(i,1);
  }
}

// =============================================
// 背景格線
// =============================================
function drawGrid(stg) {
  let c = color(stg.wc);
  stroke(red(c),green(c),blue(c), 10);
  strokeWeight(1);
  for (let x = 0; x < W; x += 45) line(x, 0, x, H);
  for (let y = 0; y < H; y += 45) line(0, y, W, y);
}

// =============================================
// 自訂游標
// =============================================
function drawCursor() {
  let c = color(curStage().ac);
  stroke(c); strokeWeight(1.5);
  let cx = mouseX, cy = mouseY;
  line(cx-10, cy, cx+10, cy);
  line(cx, cy-10, cx, cy+10);
  noFill(); stroke(red(c),green(c),blue(c),120);
  ellipse(cx, cy, 20, 20);
}

// =============================================
// HUD
// =============================================
function drawHUD() {
  let stg  = curStage();
  let diff = curDiff();

  noStroke(); fill(0,0,0,170); rect(0,0,W,36);

  fill(stg.ac); textSize(12); textAlign(LEFT);
  text(`STAGE ${stageIdx+1}: ${stg.name}  [${stg.shape}]`, 14, 22);

  fill(diff.color); textAlign(CENTER);
  text(`◈ ${diff.label} ◈`, W/2, 22);

  let lh = '';
  for (let i = 0; i < lives; i++)     lh += '♥ ';
  for (let i = lives; i < 3; i++)     lh += '♡ ';
  fill(stg.ac); textAlign(RIGHT);
  text(lh.trim(), W-14, 22);

  // 進度條
  let prog = constrain(map(ringX, topPts[0].x, topPts[topPts.length-1].x, 0, 1), 0, 1);
  noStroke(); fill(25); rect(80, H-20, W-160, 7, 3);
  fill(stg.ac); rect(80, H-20, (W-160)*prog, 7, 3);
  fill(200); textSize(10); textAlign(LEFT);
  text(`PROGRESS  ${nf(prog*100,3,0)}%`, 80, H-25);

  if (started) timer++;
  fill(stg.ac); textAlign(RIGHT);
  text(`SCORE ${score}   TIME ${nf(timer/60,3,1)}s`, W-14, H-25);
}

// =============================================
// 畫面：PLAYING
// =============================================
function drawPlaying() {
  let stg = curStage();

  drawWire();

  if (started) {
    ringX = mouseX;
    ringY = mouseY;

    if (collision()) { doFail(); return; }
    if (reachedEnd()) { doSuccess(); return; }
  }

  // 環圈
  let ac = color(stg.ac);
  noFill(); stroke(red(ac),green(ac),blue(ac),55); strokeWeight(9);
  ellipse(ringX, ringY, RING_R*2+8, RING_R*2+8);
  stroke(ac); strokeWeight(2.5);
  ellipse(ringX, ringY, RING_R*2, RING_R*2);
  fill(ac); noStroke();
  ellipse(ringX, ringY, 4, 4);

  tickParticles();
  drawHUD();

  if (!started) {
    // 起點提示閃爍
    let a = map(sin(pulse*3), -1, 1, 100, 255);
    let sx = topPts[0].x, sy = (topPts[0].y+botPts[0].y)/2;
    noFill(); stroke(255,255,0,a); strokeWeight(2);
    ellipse(sx, sy, 38, 38);
    noStroke(); fill(255,255,0,a);
    textSize(12); textAlign(CENTER);
    text('將環圈移至起點並按滑鼠開始', W/2, H-46);
  }
}

// =============================================
// 失敗 / 成功 觸發
// =============================================
function doFail() {
  boom(ringX, ringY, curStage().wc);
  flash = 25; flashCol = [255,30,0];
  shake = 18;
  lives--;
  if (lives <= 0) { state = 'FAIL'; }
  else { buildWire(); placeRing(); }
}

function doSuccess() {
  confetti(W/2, H/2);
  flash = 20; flashCol = [0,255,120];
  let diffBonus = (DIFF_KEYS.indexOf(diffKey)+1) * 200;
  let timeBonus = max(0, 1000 - timer * 2);
  score += 1000 + diffBonus + timeBonus;
  let key = diffKey + stageIdx;
  let secs = timer / 60;
  if (!bestTimes[key] || secs < bestTimes[key]) bestTimes[key] = secs;
  stageIdx++;
  state = 'SUCCESS';
}

// =============================================
// 畫面：SUCCESS
// =============================================
function drawSuccess() {
  if (frameCount % 10 === 0) confetti(W/2, H/2);
  tickParticles();

  let p = map(sin(pulse*2), -1, 1, 0.9, 1.1);
  textAlign(CENTER);
  push(); translate(W/2, H/2-70); scale(p);
  for (let g = 4; g > 0; g--) { fill(0,255,136,20*g); textSize(74+g); text('CLEAR!',0,0); }
  fill(0,255,136); textSize(74); text('CLEAR!',0,0);
  pop();

  fill(255,220,0); textSize(18);
  text(`✦ ${STAGE_DEFS[(stageIdx-1)%STAGE_DEFS.length].name} 通關 ✦`, W/2, H/2+5);
  fill(200); textSize(13);
  text(`SCORE: ${score}   TIME: ${nf(timer/60,2,2)}s`, W/2, H/2+32);

  btns = {};
  if (stageIdx < 5) {
    drawBtn(W/2, H/2+105, 220, 44, '▶  下一關', '#00ff88', 'next');
  } else {
    fill(255,220,0); textSize(15);
    text('🎉 全部關卡通關！你是傳說！', W/2, H/2+100);
    drawBtn(W/2, H/2+140, 220, 42, '↺  重新挑戰', '#ffdd00', 'restart');
  }
  drawBtn(W/2, H/2+160, 220, 42, '⌂  回主選單', '#888', 'menu');
}

// =============================================
// 畫面：FAIL
// =============================================
function drawFail() {
  tickParticles();
  let a = map(sin(pulse*3), -1, 1, 160, 255);
  textAlign(CENTER);
  for (let g = 4; g > 0; g--) { fill(255,30,0,22*g); textSize(70+g); text('GAME OVER',W/2,H/2-65); }
  fill(255,50+floor(random(40)),0,a); textSize(70);
  text('GAME OVER', W/2, H/2-65);

  fill(255,120,120); textSize(15);
  text('你被電到了！所有生命耗盡', W/2, H/2-10);
  fill(200); textSize(13);
  text(`最終分數: ${score}　抵達關卡: ${stageIdx+1} / 5`, W/2, H/2+20);

  btns = {};
  drawBtn(W/2, H/2+95, 220, 44, '↺  再試一次', '#ff4444', 'retry');
  drawBtn(W/2, H/2+150, 220, 44, '⌂  回主選單', '#888',    'menu');
}

// =============================================
// 畫面：MENU
// =============================================
function drawMenu() {
  textAlign(CENTER);
  for (let g = 5; g > 0; g--) { fill(0,255,136,16*g); textSize(68+g); text('電流急急棒', W/2, 148); }
  let a = map(sin(pulse),-1,1,180,255);
  fill(0,255,136,a); textSize(68);
  text('電流急急棒', W/2, 148);

  fill(160,255,210,200); textSize(16);
  text('WIRE BUZZ CHALLENGE', W/2, 180);

  stroke(0,255,136,40); strokeWeight(1);
  line(80,196, W-80,196);

  btns = {};
  drawBtn(W/2, 258, 210, 46, '▶  開始遊戲', '#00ff88', 'start');
  drawBtn(W/2, 316, 210, 46, '◈  選擇難度', '#ffdd00', 'diff');
  drawBtn(W/2, 374, 210, 46, '?  說　　明', '#ff6699', 'howto');

  let d = curDiff();
  noStroke(); fill(d.color); textSize(12);
  text(`目前難度：${d.label}`, W/2, H-14);

  tickParticles();
}

// =============================================
// 畫面：DIFF_SELECT
// =============================================
function drawDiffSelect() {
  textAlign(CENTER);
  fill(0,255,136); textSize(26);
  text('選擇難度', W/2, 80);
  stroke(0,255,136,35); strokeWeight(1); line(80,98,W-80,98);

  btns = {};
  let ys = [170,248,326,404];
  DIFF_KEYS.forEach((dk,i) => {
    let d = DIFFS[dk];
    drawBtn(W/2, ys[i], 360, 56, `${d.label}　通道 ${d.minGap}–${d.maxGap}px`, d.color, 'diff_'+dk);
    // 已選標記
    if (dk === diffKey) {
      fill(d.color); noStroke(); textSize(12);
      text('◀ 已選', W/2 + 210, ys[i]+5);
    }
  });
  drawBtn(W/2, H-50, 160, 38, '← 返回', '#888', 'back');
}

// =============================================
// 通用按鈕
// =============================================
function drawBtn(x, y, w, h, label, col, id) {
  btns[id] = {x, y, w, h};
  let hover = mouseX > x-w/2 && mouseX < x+w/2 && mouseY > y-h/2 && mouseY < y+h/2;
  let c = color(col);
  fill(red(c),green(c),blue(c), hover ? 35 : 12);
  stroke(col); strokeWeight(hover ? 2 : 1);
  rect(x-w/2, y-h/2, w, h, 5);
  fill(hover ? col : color(red(c),green(c),blue(c),200));
  noStroke(); textSize(14); textAlign(CENTER);
  text(label, x, y+5);
}

function hitBtn(id) {
  if (!btns[id]) return false;
  let b = btns[id];
  return mouseX > b.x-b.w/2 && mouseX < b.x+b.w/2 &&
         mouseY > b.y-b.h/2 && mouseY < b.y+b.h/2;
}

// =============================================
// 滑鼠
// =============================================
function mousePressed() {
  if (state === 'MENU') {
    if (hitBtn('start')) { fullReset(); buildWire(); placeRing(); state = 'PLAYING'; }
    else if (hitBtn('diff'))  state = 'DIFF';
    else if (hitBtn('howto')) {
      alert(
        '【玩法說明】\n\n' +
        '① 將環圈移到左側起點圓圈範圍內，按下滑鼠左鍵開始\n' +
        '② 移動滑鼠引導環圈穿越導線通道到達右側終點\n' +
        '③ 環圈碰到上下導線即扣一命，生命歸零則遊戲結束\n' +
        '④ 共 5 關，每關路徑形狀完全不同\n\n' +
        '【五關路徑】\n' +
        '第1關 訓練場  — 平緩波浪\n' +
        '第2關 工廠    — Z字鋸齒\n' +
        '第3關 熔爐    — 急升急降\n' +
        '第4關 量子迷宮— 大S彎道\n' +
        '第5關 終極試煉— 複合迷陣\n\n' +
        '【難度】\n' +
        '簡單:通道40~58px  普通:28~40px  困難:18~28px  地獄:12~19px'
      );
    }
  } else if (state === 'DIFF') {
    DIFF_KEYS.forEach(dk => { if (hitBtn('diff_'+dk)) diffKey = dk; });
    if (hitBtn('back')) state = 'MENU';
  } else if (state === 'PLAYING' && !started) {
    let sx = topPts[0].x, sy = (topPts[0].y+botPts[0].y)/2;
    if (dist(mouseX, mouseY, sx, sy) < 48) started = true;
  } else if (state === 'SUCCESS') {
    if (hitBtn('next'))    { buildWire(); placeRing(); lives = min(lives+1,3); state = 'PLAYING'; }
    else if (hitBtn('restart')) { fullReset(); buildWire(); placeRing(); state = 'PLAYING'; }
    else if (hitBtn('menu'))    { fullReset(); state = 'MENU'; }
  } else if (state === 'FAIL') {
    if (hitBtn('retry'))    { fullReset(); buildWire(); placeRing(); state = 'PLAYING'; }
    else if (hitBtn('menu')) { fullReset(); state = 'MENU'; }
  }
}

function fullReset() {
  lives = 3; score = 0; timer = 0;
  stageIdx = 0; particles = [];
  started = false;
}
