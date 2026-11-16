/* deck.js — the choreography: every beat, transition and speaker note.
 *
 * Rules (see CLAUDE.md):
 *   - Set every starting state up front with gsap.set, outside the timeline.
 *   - On the timeline use only .to() and .set(). Never .from() or .fromTo().
 *   - Anything drawn by code is a watcher: tween a plain object, Deck.watch redraws it.
 *   - Each scene hides its own elements when the next scene begins.
 *
 * Markup classes:  .a  = a block that starts hidden and arrives whole
 *                  .sp = a headline split into words (the words start hidden)
 *                  .x  = hidden only when the scene leaves (its content animates by itself)
 */
Deck.start(function (B) {
  'use strict';
  var tl = B.tl, cloud = B.cloud, S = cloud.state, Shapes = cloud.Shapes, N = cloud.count;
  var $ = function (id) { return document.getElementById(id); };

  /* ------------------------------ helpers ------------------------------ */
  function show(sel, t, vars) {
    var v = { autoAlpha: 1, y: 0, duration: 0.9 }, k;
    for (k in (vars || {})) v[k] = vars[k];
    tl.to(sel, v, t);
  }
  function hide(sel, t) { tl.to(sel, { autoAlpha: 0, y: -22, duration: 0.45, ease: 'power2.in' }, t); }
  function words(sp, t, stagger) { tl.to(sp.words, { autoAlpha: 1, y: 0, stagger: stagger || 0.09, duration: 1 }, t); }
  function wordsOut(sp, t) { tl.to(sp.words, { autoAlpha: 0, y: -30, stagger: 0.03, duration: 0.45, ease: 'power2.in' }, t); }
  function dim(sel, t) { tl.to(sel, { opacity: 0.36, duration: 0.7, ease: 'power2.out' }, t); }
  function leave(id, t) {
    tl.to('#' + id + ' .a, #' + id + ' .sp, #' + id + ' .x', { autoAlpha: 0, y: -26, duration: 0.55, ease: 'power2.in' }, t);
  }
  // every dial of the cloud, so no page inherits leftovers from the one before
  function look(vars) {
    var v = { x: 0, y: 0, scale: 1, tilt: 0, roll: 0, spin: 0.1, lock: 0, yaw: 0, sway: 0, opacity: 1, size: 3.6, noise: 0.2, wave: 0, burst: 0 }, k;
    for (k in vars) v[k] = vars[k];
    return v;
  }
  function colors(a, b, t, dur) { var v = cloud.colors(a, b); v.duration = dur || 2.2; v.ease = 'sine.inOut'; tl.to(S, v, t); }
  function bg(h1, h2, l, t) { tl.to(Deck.bg, { h1: h1, h2: h2, l: l, duration: 2.4, ease: 'sine.inOut' }, t); }
  // keep a label on a dot of the cloud (camera maths: top of particles.js)
  function pin(el, point) {
    Deck.watch(S, function () {
      var p = cloud.project(point);
      el.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px)';
    });
  }
  var pct1 = function (v) { return v.toFixed(1) + '%'; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var seg = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };

  /* ------------------------------ starting states ------------------------------ */
  gsap.set('.scene .a', { autoAlpha: 0, y: 28 });
  var split = {};
  ['so-head', 'ar-head', 'ar-head2', 'ar-head3', 'en-head'].forEach(function (id) {
    split[id] = Deck.split($(id));
    gsap.set(split[id].words, { autoAlpha: 0, y: 56 });
  });
  gsap.set('#ar-flow', { autoAlpha: 0 });
  gsap.set('#dm-screen', { autoAlpha: 0, scale: 0.96 });
  var wave = Shapes.wave(N);

  /* ============================== page 0 — Start ==============================
     Nothing but the drifting background until the first click. */
  S.scale = 1; S.opacity = 0.75; S.spin = 0.04; S.noise = 1; S.size = 3.2;

  /* ============================== page 1 — the problem ============================== */
  B.scene('المشكلة: لماذا منصة للعقود؟');
  var n24 = Deck.counter($('pr-n0'), function (v) { return String(Math.round(v)); }), n86 = Deck.counter($('pr-n1'), pct1);
  var t = B.t();
  B.morph(Shapes.papers(N), look({ x: -470, y: 0, scale: 1, tilt: 0.2, spin: 0.12, sway: 0.4, noise: 0.5, size: 3.4 }), t);
  colors('#9fb2d8', '#e8ecf5', t); bg(226, 250, 13, t);
  show('#pr-kicker', t + 0.9); show('#pr-0', t + 1.1); show('#pr-src0', t + 1.7);
  tl.to(n24, { v: 24, duration: 2, ease: 'power2.out' }, t + 1.1);
  B.beat('problem', 'ابدأ بالوقت: كم يستغرق العقد؟ بحسب دراسة المقارنة المرجعية لـ World Commerce & Contracting لعام 2023، العقد عالي التعقيد يأخذ في المتوسط 24 أسبوعاً (نحو ستة أشهر) من تقديم العرض إلى التوقيع، ومتوسط التعقيد 11.6 أسبوعاً، وحتى العقد البسيط 4.4 أسابيع، أي شهراً كاملاً. النقاط أوراق مبعثرة: هنا يذهب الوقت، بين نسخة في البريد ونسخة على جهاز وتعديل لا يُعرف صاحبه. تنبيهات: (1) هذه متوسطات عالمية للعقود المحلية، وليست عن السعودية ولا عن وادي مكة؛ العقود الدولية أطول (6.5 و13.7 و29.6 أسبوعاً). (2) المدة تُقاس من تقديم العرض إلى التوقيع وتشمل التفاوض، لا كتابة العقد وحدها. (3) لم نستطع فتح التقرير الأصلي لأنه للأعضاء فقط؛ الأرقام من شرائح الدراسة كما ظهرت في نتائج البحث، فقل «بحسب WorldCC» ولا تزد. إن كان عندك رقم حقيقي عن مدة العقد في وادي مكة فهو أقوى من كل هذا: اذكره بصوتك.');

  t = B.t();
  hide('#pr-0, #pr-src0', t);
  show('#pr-1', t + 0.45); show('#pr-src1', t + 0.9);
  tl.to(n86, { v: 8.6, duration: 1.8, ease: 'power2.out' }, t + 0.45);
  colors('#f2b03c', '#ff7a5c', t, 1.6);
  tl.to(S, { burst: 0.1, noise: 0.9, spin: 0.2, duration: 1.4, ease: 'power2.out' }, t);
  B.beat('problem-cost', 'الأوراق تتباعد: القيمة تتسرّب. دراسة World Commerce & Contracting مع Deloitte (2023، أكثر من 1,200 منظمة) قدّرت متوسط «تآكل القيمة» في العقود بـ 8.6%، وأفضل المنظمات أداءً تخسر نحو 3% فقط. تنبيهات: الرقم متوسط عالمي عام وليس عن السعودية ولا عن وادي مكة. وهو يقيس الفرق بين ما كان متوقعاً من العقد وما تحقق فعلاً. والجهة نفسها تقول إنه رقم إرشادي يصعب التحقق منه علمياً. كثيرون يقولون «9% من الإيرادات»: تلك صيغة أقدم، فالتزم بـ 8.6%.');

  /* ============================== page 2 — the solution and the Wadi Makkah idea ============================== */
  B.scene('الحل وفكرة «وادي مكة»');
  t = B.t();
  leave('s-problem', t);
  B.morph(Shapes.contract(N), look({ x: -470, y: 0, scale: 1.25, tilt: 0.05, lock: 1, yaw: -0.35, sway: 0.6, spin: 0, noise: 0.07, size: 3.4 }), t);
  colors('#4cc4f0', '#ffffff', t); bg(214, 236, 14, t);
  show('#so-kicker', t + 0.9); words(split['so-head'], t + 1.1, 0.14); show('#so-lede', t + 1.7); show('#so-src1', t + 2);
  B.beat('solution', 'الأوراق المبعثرة تجتمع في عقد واحد واضح. «عقودك، بوضوح.» هي عبارة المنصة نفسها على شاشة الدخول، ومعها: فريق واحد، صلاحيات واضحة، ومساحة عمل مشتركة. اشرح الفكرة في جملة: مكان واحد يُكتب فيه العقد ويُراجع ويُعتمد، وكل شخص يرى ما يخصّه.');

  t = B.t();
  hide('#so-a, #so-src1', t);
  B.morph(wave, look({ x: -470, y: 10, scale: 0.7, tilt: 0.3, lock: 1, yaw: -0.25, sway: 0.8, spin: 0, noise: 0.08, wave: 0.3, size: 2.9 }), t);
  colors('#29b6e8', '#9a78e0', t); bg(204, 282, 14, t);
  show('#so-b', t + 0.7); show('#so-src2', t + 1.2);
  B.beat('solution-wadi', 'النقاط تصير أمواج الوادي، كما في شعار الشركة. شركة وادي مكة للتقنية مملوكة لجامعة أم القرى، وتأسست بقرار من مجلس إدارة الجامعة في 3 أبريل 2012م (11 جمادى الأولى 1433هـ). المنصة مبنية لها: قوالب عقودها وهويتها. تنبيه: معلومة التأسيس من موسوعة سعوديبيديا؛ إن كان عندك مصدر رسمي من الشركة فهو أولى.');

  t = B.t();
  hide('#so-b, #so-src2', t);
  show('#so-c', t + 0.45);
  tl.to(S, { scale: 0.78, size: 3.3, duration: 1.6, ease: 'power2.out' }, t);
  B.beat('solution-one-place', 'الخلاصة في جملة: من القالب إلى التوقيع، في مكان واحد. تختار قالباً، تعبّئ البيانات، تراجع البنود، تمرّ بالمراجعة، ثم المعاينة والتوقيع. هذه الجملة تمهّد للصفحة التالية: كيف يسير العمل داخل المنصة.');

  /* ============================== page 3 — architecture and workflow ============================== */
  B.scene('البنية وسير العمل');
  var k;
  for (k = 0; k < 4; k++) pin($('pin-s' + (k + 1)), Shapes.stepPoint(k));
  for (k = 0; k < 3; k++) pin($('pin-l' + (k + 1)), Shapes.layerPoint(k));
  // the four states: chips appear and the lines draw themselves as p goes 0 -> 1
  var flow = Deck.watch({ p: 0 }, function (f) {
    var p = f.p, chips = [[0, 0.1], [0.3, 0.4], [0.55, 0.65], [0.8, 0.88]], lines = [[0.1, 0.3], [0.4, 0.55], [0.65, 0.8], [0.88, 1]], i;
    for (i = 0; i < 4; i++) {
      $('fl-c' + (i + 1)).style.opacity = seg(p, chips[i][0], chips[i][1]).toFixed(3);
      var d = seg(p, lines[i][0], lines[i][1]);
      $('fl-a' + (i + 1)).style.strokeDashoffset = (1 - d).toFixed(4);
      $('fl-a' + (i + 1)).style.opacity = d > 0.001 ? 1 : 0;
      $('fl-h' + (i + 1)).style.opacity = seg(d, 0.9, 1).toFixed(3);
    }
  });
  t = B.t();
  leave('s-solution', t);
  B.morph(Shapes.pipeline(N), look({ x: 0, y: -75, scale: 1.15, lock: 1, yaw: 0, spin: 0, noise: 0, size: 3.8 }), t);
  colors('#8dc63f', '#29b6e8', t); bg(160, 212, 13, t);
  show('#ar-kicker', t + 0.8); words(split['ar-head'], t + 1);
  for (k = 0; k < 4; k++) tl.to('#pin-s' + (k + 1), { autoAlpha: 1, duration: 0.5 }, t + 2.1 + k * 0.28);
  show('#ar-src', t + 2.4);
  B.beat('flow-steps', 'كل عقد يمرّ بأربع خطوات، وهي نفسها التي تظهر أعلى شاشة العقد في المنصة: (1) بيانات العقد: تعبئة حقول القالب. (2) البنود: ثابتة وقابلة للتعديل ومولّدة من البيانات. (3) المراجعة الذكية: المحرك يضع ملاحظاته على النص. (4) المعاينة والرفع: المستند النهائي والتوقيع. اقرأها من اليمين إلى اليسار مع اتجاه الأسهم.');

  t = B.t();
  wordsOut(split['ar-head'], t); words(split['ar-head2'], t + 0.45);
  tl.to(S, { opacity: 0.6, duration: 0.8 }, t);
  tl.to('#ar-flow', { autoAlpha: 1, duration: 0.5 }, t + 0.3);
  tl.to(flow, { p: 1, duration: 3, ease: 'none' }, t + 0.4);
  B.beat('flow-states', 'ولكل عقد أربع حالات تظهر في لوحة المتابعة: مسودة (قيد الإعداد)، ثم قيد المراجعة (لدى المراجع القانوني)، ثم معتمدة. وإن وُجدت ملاحظات يعود العقد «معاداً للتعديل» إلى صاحبه ثم يدخل الدورة من جديد. هذه الحلقة هي ما كان يضيع في البريد. الأسماء مأخوذة من واجهة المنصة كما هي.');

  t = B.t();
  wordsOut(split['ar-head2'], t); words(split['ar-head3'], t + 0.45);
  tl.to('#ar-flow', { autoAlpha: 0, duration: 0.45, ease: 'power2.in' }, t);
  tl.to('#pin-s1, #pin-s2, #pin-s3, #pin-s4', { autoAlpha: 0, duration: 0.4 }, t);
  B.morph(Shapes.layers(N), look({ x: -420, y: 25, scale: 1, tilt: 0.42, lock: 1, yaw: -0.5, spin: 0, noise: 0.03, size: 3.6 }), t);
  colors('#b58ad0', '#29b6e8', t); bg(268, 212, 13, t);
  for (k = 0; k < 3; k++) tl.to('#pin-l' + (k + 1), { autoAlpha: 1, duration: 0.5 }, t + 2.2 + k * 0.3);
  hide('#ar-src', t); show('#ar-src2', t + 2.4);
  B.beat('arch-layers', 'البنية في ثلاث طبقات: (1) الواجهة: تطبيق صفحة واحدة مبني بمكتبة React، يعمل كله في المتصفح، ومستضاف على Netlify. (2) الخادم وقاعدة البيانات: خدمة Supabase، وهي قاعدة بيانات PostgreSQL مع تسجيل الدخول والصلاحيات؛ حفظ العقد وأوامره (إرسال للمراجعة، اعتماد، إعادة) تمرّ عبر دوال في قاعدة البيانات، وللحسابات سجلّ تدقيق. والتوقيع برمز التحقق له دالة خاصة على الخادم. (3) محرك المراجعة وله وضعان: «محاكاة محلية» بقواعد تعمل داخل المتصفح فلا يغادر النص الجهاز، و«مراجعة حية» ترسل النص إلى دالة على الخادم تستدعي نموذج Gemini من Google. تنبيه: هذه المعلومات من فحص شيفرة النسخة التجريبية كما تصل إلى المتصفح، لا من وثيقة تصميم ولا من شيفرة الخادم. لم نرَ ما تفعله دوال الخادم من الداخل، ولا أي إصدار من Gemini يُستخدم. إن سأل الأستاذ عن ذلك فقل إنه عند الفريق التقني. وإن سأل لماذا Supabase و Netlify: جاهزتان وسريعتان لنسخة تجريبية، وقرار الاستضافة النهائي (داخل المملكة مثلاً) لم يُحسم.');

  /* ============================== page 4 — demonstration ============================== */
  B.scene('العرض التطبيقي');
  // A camera over a strip of screenshots. x,y = the point of the strip at the middle of the screen; lz = log of zoom.
  var VW = 1200, VH = 657, GAP = 1400, film = $('dm-film');
  var cam = Deck.watch({ x: VW / 2, y: VH / 2, lz: 0 }, function (c) {
    var z = Math.exp(c.lz);
    film.style.transform = 'translate(' + (VW / 2 - c.x * z).toFixed(2) + 'px,' + (VH / 2 - c.y * z).toFixed(2) + 'px) scale(' + z.toFixed(4) + ')';
  });
  function whole(i) { return { x: i * GAP + VW / 2, y: VH / 2, lz: 0 }; }
  // look at the point (fx, fy) of screenshot i (0..1 each) at zoom z, without showing anything outside the picture
  function focus(i, fx, fy, z) {
    return { x: i * GAP + clamp(fx, 0.5 / z, 1 - 0.5 / z) * VW, y: clamp(fy, 0.5 / z, 1 - 0.5 / z) * VH, lz: Math.log(z) };
  }
  function to(target, t, dur, ease) { target.duration = dur; target.ease = ease; tl.to(cam, target, t); }
  var shots = [
    ['demo-login', 0.8, 0.5, 1.35, 'شاشة الدخول. الدخول لأعضاء الفريق الذين يضيفهم مدير النظام فقط، وكل عضو يفعّل حسابه برابط. حقل البريد في اللقطة فارغ عمداً.'],
    ['demo-dashboard', 0.5, 0.4, 1.15, 'لوحة المتابعة: إجمالي العقود وعددها في كل حالة (مسودات، قيد المراجعة، معادة للتعديل، معتمدة) وتوزيعها حسب النوع. تنبيه: الأرقام الظاهرة (5 عقود، كلها معتمدة تجريبياً) بيانات تجريبية من النسخة التجريبية وليست عقوداً حقيقية.'],
    ['demo-contracts', 0.5, 0.65, 1.15, 'صفحة العقود: بحث باسم العقد أو الطرف الثاني، تصفية حسب الحالة والنوع، ولكل عقد بطاقة برقمه المرجعي وحالته وزر المتابعة. العقود الظاهرة تجريبية.'],
        ['demo-data', 0.3, 0.68, 1.55, 'الخطوة الأولى: بيانات العقد، وهذه تعبئة حقيقية داخل المنصة صُوِّرت حقلاً حقلاً. القالب هو «عقد توريد — قالب تجريبي». الحقول تمتلئ بسرعة: عنوان العقد، الطرفان، البند والكمية، القيمة، المدة، حتى يصير العدّاد «10 من 10 حقول مطلوبة». لا تقرأ الحقول؛ دعها تجري وقل: دقيقة واحدة بدل ساعة في Word. تنبيه: كل البيانات وهمية (مؤسسة المثال التجارية، فلان الفلاني، سجل 1010000000) والمسودة رقمها SUP-2026-00018 في النسخة التجريبية. الحركة طويلة (نحو 8 ثوانٍ)؛ ضغطة ثانية تنهيها فوراً.'],
    ['demo-clauses', 0.5, 0.62, 1.15, 'الخطوة الثانية: البنود. ثلاثة أنواع: مولّد من البيانات (يتغيّر بتعديل الخطوة الأولى)، ثابت لا يُعدّل، وقابل للتعديل. ويمكن إضافة شرط خاص. لاحظ أن قيمة العقد تُكتب رقماً وكتابةً وتُحسب الضريبة تلقائياً.'],
    ['demo-review', 0.6, 0.55, 1.18, 'الخطوة الثالثة: المراجعة الذكية. المحرك له وضعان: «محاكاة محلية» (قواعد داخل المتصفح) و«مراجعة حية» (نموذج Gemini عبر الخادم). تنبيه مهم تكتبه المنصة نفسها: هذه مراجعة محاكاة ولا تمثّل رأياً قانونياً، واكتمالها لا يعني اعتماداً قانونياً. قلها بوضوح؛ الأستاذ سيقدّر الأمانة. في هذه اللقطة شُغّلت المحاكاة المحلية على عقد الحواسيب نفسه والنتيجة «لا ملاحظات مفتوحة»، والمنصة تكتب تحتها: نتيجة صالحة لكنها ليست اعتماداً قانونياً.'],
    ['demo-sign', 0.37, 0.56, 1.6, 'الخطوة الأخيرة: المعاينة والتوقيع. قراءة العقد والموافقة، ثم التحقق برمز OTP، ثم يظهر توقيع الطرفين في المستند مع بصمة SHA-256 للنسخة. تنبيه: التوقيع هنا «تجريبي للعرض» كما تكتب المنصة، وليس توقيعاً موثّقاً بعد. إن أمكن، افتح المنصة الحية بعد هذه الصفحة وأرِ الأستاذ خطوة واحدة فعلياً.']
  ];
  t = B.t();
  leave('s-arch', t); tl.to('#pin-l1, #pin-l2, #pin-l3', { autoAlpha: 0, duration: 0.4 }, t);
  B.morph(Shapes.monitor(N), look({ x: -250, y: 0, scale: 1, lock: 1, yaw: 0, spin: 0, noise: 0.04, size: 3.2, opacity: 0.85 }), t);
  colors('#5b7be0', '#29b6e8', t); bg(228, 214, 11, t);
  show('#dm-kicker', t + 0.9); show('#dm-c1', t + 1.2); show('#dm-src', t + 1.8);
  tl.to('#dm-screen', { autoAlpha: 1, scale: 1, duration: 0.9, ease: 'power2.out' }, t + 1.7);
  to(focus(0, shots[0][1], shots[0][2], shots[0][3]), t + 2.7, 1.8, 'power2.inOut');
  B.beat(shots[0][0], shots[0][4]);
  // Screenshot 4 is not one picture: it is the real form being filled, captured after every field.
  // fill.f = how many fields are filled so far (0..15); each patch picture fades in when its field is reached.
  var patches = [].slice.call(document.querySelectorAll('#dm-fill .fp'));
  var fill = Deck.watch({ f: 0 }, function (s) {
    for (var i = 0; i < patches.length; i++) patches[i].style.opacity = clamp(s.f - (+patches[i].getAttribute('data-f') - 1), 0, 1).toFixed(3);
  });
  // the tall picture is 1280 page-pixels wide, shown 1200 wide: page pixel -> strip pixel
  var PX = VW / 1280, X4 = 3 * GAP;
  function page(px, py, z) { return { x: X4 + clamp(px * PX, VW / 2 / z, VW - VW / 2 / z), y: py * PX, lz: Math.log(z) }; }
  var FIELD_Y = [537, 620, 911, 991, 1071, 1211, 1291, 1371, 1452, 1704, 1704, 1704, 1890, 2223, 2303];   // where each field sits on the page
  var PREVIEW_Y = [590, 590, 740, 740, 740, 740, 740, 740, 740, 1120, 1120, 1120, 1040, 1040, 1420];        // where its effect shows in the preview
  gsap.set('#dm-c4b', { autoAlpha: 0 });
  // Which place on the strip each screenshot sits in. Places 6 and 7 hold the review flow below; signing is place 8.
  var SLOT = [0, 1, 2, 3, 4, 5, 8], prev = 0, cap = 1;
  function nextCap(t) { hide('#dm-c' + cap, t); cap++; show('#dm-c' + cap, t + 0.5); }
  function glide(slot, t) {
    to(whole(prev), t, 0.45, 'power2.in');                        // pull back
    to(whole(slot), t + 0.45, 0.6, 'power3.inOut');               // glide across the gap to the next screen
    prev = slot;
  }
  // look at page pixel (px, py) of the picture in a place, at zoom z; H = that picture's height on the strip
  function at(slot, px, py, z, H) {
    return { x: slot * GAP + clamp(px * VW / 1280, VW / 2 / z, VW - VW / 2 / z), y: clamp(py * VW / 1280, VH / 2 / z, (H || 675) - VH / 2 / z), lz: Math.log(z) };
  }
  // a small ring that flashes where a button is pressed
  gsap.set('.tap', { autoAlpha: 0, scale: 0.4 });
  function tap(id, t) {
    tl.to(id, { autoAlpha: 1, scale: 1, duration: 0.14, ease: 'power2.out' }, t);
    tl.to(id, { autoAlpha: 0, scale: 2, duration: 0.4, ease: 'power1.out' }, t + 0.16);
  }
  // pictures stacked in one place: s = how many of the later pictures are showing
  var send = Deck.watch({ s: 0 }, function (o) {
    $('dm-s2').style.opacity = clamp(o.s, 0, 1).toFixed(3); $('dm-s3').style.opacity = clamp(o.s - 1, 0, 1).toFixed(3);
  });
  var rev = Deck.watch({ s: 0 }, function (o) {
    $('dm-r2').style.opacity = clamp(o.s, 0, 1).toFixed(3); $('dm-r3').style.opacity = clamp(o.s - 1, 0, 1).toFixed(3); $('dm-r4').style.opacity = clamp(o.s - 2, 0, 1).toFixed(3);
  });
  var TALL = 1594;                                                // the reviewer's page was captured 1700 page-pixels tall
  // Really done in the platform on the demo draft and captured step by step: send to the legal reviewer, the reviewer reads, the reviewer approves.
  function reviewFlow() {
    var t = B.t();
    nextCap(t); glide(6, t);
    to(at(6, 128, 686, 1.7), t + 1.25, 0.9, 'power2.inOut');      // the "send for legal review" button
    tap('#tap1', t + 2.3);
    tl.to(send, { s: 1, duration: 0.3, ease: 'none' }, t + 2.55); // the confirmation box
    to(at(6, 640, 230, 1.5), t + 2.55, 0.7, 'power2.inOut');
    tap('#tap2', t + 3.7);
    tl.to(send, { s: 2, duration: 0.35, ease: 'none' }, t + 3.95); // status is now "under legal review"
    to(at(6, 900, 235, 1.45), t + 3.95, 0.9, 'power2.inOut');
    B.beat('demo-send', 'الرفع للمراجع القانوني بضغطة واحدة. المنصة تتحقق أولاً: كل الحقول المطلوبة مكتملة، ولا مشكلات مفتوحة من المراجعة الذكية. ثم زر «رفع للمراجعة القانونية»، وتأكيد واحد، فتتغيّر حالة العقد إلى «قيد المراجعة القانونية» ويُقفل التعديل على صاحبه. لا بريد ولا مرفقات. تنبيه: هذا تصوير حقيقي من النسخة التجريبية على المسودة الوهمية SUP-2026-00018.');

    t = B.t();
    nextCap(t); glide(7, t);
    to(at(7, 1020, 560, 1.5), t + 1.25, 0.9, 'power2.inOut');     // the reviewer's board: the contract is waiting
    tap('#tap3', t + 2.3);
    tl.to(rev, { s: 1, duration: 0.3, ease: 'none' }, t + 2.55);  // the contract, as the reviewer sees it
    to(at(7, 428, 430, 1.5, TALL), t + 2.55, 0.8, 'power2.inOut');
    to(at(7, 428, 1280, 1.5, TALL), t + 3.6, 3.4, 'sine.inOut');  // reading down the clauses
    B.beat('demo-reviewer', 'ننتقل إلى الطرف الآخر: لوحة المراجع القانوني. العقد وصل إليه فوراً: «1 عقود بانتظار مراجعتك». يفتحه فيرى نص العقد بنداً بنداً، وبجانب كل بند زر «تعليق» ليكتب ملاحظته للموظف في مكانها. الكاميرا تنزل على البنود كأن المراجع يقرأ. وعنده خياران أسفل الصفحة: «إعادة للتعديل» (ويشترط تعليقاً واحداً على الأقل) أو «اعتماد». تنبيه: في النسخة التجريبية دخلنا بحساب مدير النظام الذي يرى الصفحتين معاً؛ في الواقع للمراجع حسابه وصلاحيته.');

    t = B.t();
    nextCap(t);
    to(at(7, 140, 1667, 1.8, TALL), t, 1.2, 'power2.inOut');      // the Approve button at the bottom of the page
    tap('#tap4', t + 1.35);
    tl.to(rev, { s: 2, duration: 0.3, ease: 'none' }, t + 1.6);   // the confirmation box
    to(at(7, 640, 235, 1.5), t + 1.6, 0.8, 'power2.inOut');
    tap('#tap5', t + 2.85);
    tl.to(rev, { s: 3, duration: 0.35, ease: 'none' }, t + 3.1);  // approved
    to(at(7, 880, 240, 1.4), t + 3.1, 0.9, 'power2.inOut');
    B.beat('demo-approve', 'المراجع يضغط «اعتماد»، ثم تأكيد، فتصير الحالة «معتمد (تجريبياً)» ويصبح العقد للقراءة فقط، ويظهر قسم التوقيع الإلكتروني. تنبيه مهم تكتبه المنصة نفسها في نافذة التأكيد: «اعتماد تجريبي داخل النموذج فقط. لا يمثل اعتماداً قانونياً أو نظامياً». قلها بصوتك؛ وهي تمهّد للتوصيات في الصفحة الأخيرة.');
  }
  for (k = 1; k < shots.length; k++) {
    t = B.t();
    if (k === 6) { reviewFlow(); t = B.t(); }                     // three extra clicks before the signing screen
    nextCap(t); glide(SLOT[k], t);
    if (k !== 3) {
      to(focus(SLOT[k], shots[k][1], shots[k][2], shots[k][3]), t + 1.05, 1.4, 'power2.out');   // push in
      B.beat(shots[k][0], shots[k][4]);
      continue;
    }
    // click 1 of 2: close on the form (right column); the fields fill one after another and the camera follows them down
    var i, step = 0.4, t0 = t + 2.1;
    to(page(924, FIELD_Y[0], 2), t + 1.05, 0.9, 'power2.inOut');
    for (i = 0; i < FIELD_Y.length; i++) {
      if (i && FIELD_Y[i] !== FIELD_Y[i - 1]) to(page(924, FIELD_Y[i], 2), t0 + i * step - 0.22, 0.36, 'power1.inOut');
      tl.to(fill, { f: i + 1, duration: 0.22, ease: 'none' }, t0 + i * step);
    }
    B.beat(shots[k][0], shots[k][4]);
    // click 2 of 2: rewind, move to the preview (left column) and fill again: the document writes itself with every entry
    t = B.t();
    tl.to('#dm-c4a', { autoAlpha: 0, duration: 0.4 }, t); tl.to('#dm-c4b', { autoAlpha: 1, duration: 0.6 }, t + 0.4);
    tl.to(fill, { f: 0, duration: 0.7, ease: 'none' }, t);
    to(page(342, PREVIEW_Y[0], 1.9), t, 1.1, 'power2.inOut');
    step = 0.45; t0 = t + 1.4;
    for (i = 0; i < PREVIEW_Y.length; i++) {
      if (i && PREVIEW_Y[i] !== PREVIEW_Y[i - 1]) to(page(342, PREVIEW_Y[i], 1.9), t0 + i * step - 0.3, 0.5, 'power1.inOut');
      tl.to(fill, { f: i + 1, duration: 0.25, ease: 'none' }, t0 + i * step);
    }
    B.beat('demo-preview', 'النقرة نفسها من الجهة الأخرى: الحقول تُفرَّغ ثم تمتلئ من جديد، والكاميرا الآن على المعاينة في اليسار. مع كل إدخال يُكتب المستند نفسه: العنوان، جدول الطرفين، ملخص البيانات، جدول التوريد. وعند إدخال القيمة (115,000 ريال) تُحسب الدفعات تلقائياً: 30% = 34,500 و70% = 80,500. هذه هي الفكرة كلها: لا أحد يكتب العقد يدوياً. تنبيه: المعاينة تُظهر وسم «مسودة تجريبية — بيانات وهمية — غير معتمدة» وهو من المنصة نفسها.');
  }

  /* ============================== page 5 — conclusion and recommendations ============================== */
  B.scene('الخلاصة والتوصيات');
  t = B.t();
  leave('s-demo', t);
  B.morph(Shapes.seal(N), look({ x: -480, y: 0, scale: 1.15, tilt: 0.1, lock: 1, yaw: -0.3, sway: 0.7, spin: 0, noise: 0.08, size: 3.6 }), t);
  colors('#8dc63f', '#f2b03c', t); bg(150, 40, 13, t);
  show('#en-kicker', t + 0.9); show('#en-1', t + 1.1); show('#en-src', t + 1.6);
  B.beat('rec-sign', 'النقاط تصير ختم «معتمد». التوصية الأولى: توقيع موثوق. التوقيع الحالي تجريبي، والنظام يربط موثوقية التوقيع بشهادة تصديق رقمي من جهة مرخّصة؛ فالخطوة التالية ربط المنصة بمزوّد تصديق مرخّص. تنبيه: التوصيات الثلاث اقتراح مبني على ما يظهر في النسخة التجريبية. غيّرها إن كانت خلاصتك مختلفة.');

  t = B.t();
  dim('#en-1', t); show('#en-2', t);
  B.beat('rec-templates', 'التوصية الثانية: قوالب معتمدة. المنصة نفسها تضع على القوالب وسم «قالب تجريبي غير معتمد» و«يحتاج مراجعة». قبل الاستخدام الفعلي يجب أن تعتمد الإدارة القانونية كل قالب وبنوده الثابتة.');

  t = B.t();
  dim('#en-2', t); show('#en-3', t);
  tl.to(S, { size: 4.2, duration: 1.2 }, t);
  B.beat('rec-review', 'التوصية الثالثة: مراجعة حيّة. المراجعة الآن محاكاة بقواعد تجريبية. المطلوب تشغيل «المراجعة الحية» ثم قياس دقتها: كم ملاحظة صحيحة وكم خاطئة مقارنةً بمراجع قانوني بشري، قبل الاعتماد عليها. وتبقى الكلمة الأخيرة للمراجع البشري.');

  t = B.t();
  hide('#en-kicker, #en-1, #en-2, #en-3, #en-src', t);
  B.morph(wave, look({ x: 0, y: 285, scale: 0.9, tilt: 0.3, lock: 1, yaw: 0, sway: 0.8, spin: 0, noise: 0.08, wave: 0.3, size: 2.9 }), t);
  colors('#29b6e8', '#9a78e0', t); bg(214, 282, 13, t);
  show('#en-logo', t + 1.1); words(split['en-head'], t + 1.4, 0.18);
  B.beat('close', 'الختم يعود أمواج الوادي. اختم بعبارة المنصة: «عقودك، بوضوح.» لخّص في جملة: مشكلة العقود المبعثرة، منصة واحدة بأربع خطوات، وثلاث توصيات قبل التشغيل الفعلي. ثم اشكر الأستاذ بصوتك وافتح باب الأسئلة. يمكنك الضغط على B لتسويد الشاشة أثناء النقاش.');

  B.slot('end');
});
