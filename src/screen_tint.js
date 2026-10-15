import { Scene, OrthographicCamera, PlaneGeometry, Mesh, ShaderMaterial } from 'three';

/** 출혈·감정 색을 장면과 같은 drawing buffer에 합성한다.
 *  Safari의 별도 전체 화면 CSS 층/타일 크기가 남아 오른쪽 색이 갈리는 경로를 없앤다. */
export function createScreenTint() {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = { blood: { value: 0 }, emotion: { value: 0 }, kind: { value: 0 } };
  const material = new ShaderMaterial({
    uniforms, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `precision highp float;
      varying vec2 vUv;
      uniform float blood, emotion, kind;
      // CSS radial-gradient(ellipse farthest-corner)와 같은 좌표·정지점.
      vec4 gradient(float r, float start, float middle, vec3 a, float aa, vec3 b, float ba) {
        vec4 mid = vec4(a * aa, aa);
        return r < middle ? mid * clamp((r - start) / (middle - start), 0.0, 1.0)
          : mix(mid, vec4(b * ba, ba), clamp((r - middle) / (1.0 - middle), 0.0, 1.0));
      }
      void main() {
        float r = length((vUv - .5) * 2.0) / sqrt(2.0);
        vec4 b = gradient(r, .45, .78, vec3(120.,0.,0.)/255., .55, vec3(60.,0.,0.)/255., .9) * blood;
        vec4 e = vec4(0.);
        if (kind > 2.5) e = gradient(r, .55, .88, vec3(220.,170.,40.)/255., .4, vec3(140.,90.,0.)/255., .75);
        else if (kind > 1.5) e = gradient(r, .55, .88, vec3(200.,30.,0.)/255., .45, vec3(120.,0.,0.)/255., .8);
        else if (kind > .5) e = gradient(r, .5, .85, vec3(60.,80.,110.)/255., .5, vec3(20.,30.,50.)/255., .8);
        e *= emotion;
        vec4 c = e + b * (1.0 - e.a);
        // 위 식은 premultiplied, Three의 일반 투명 블렌딩에는 straight RGBA.
        gl_FragColor = vec4(c.rgb / max(c.a, .00001), c.a);
      }`,
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  let bloodTarget = 0, emotionTarget = 0;
  const tint = {
    visible: false,
    setBlood(value) { bloodTarget = Math.min(1, Math.max(0, value)); },
    setEmotion(name, value) {
      uniforms.kind.value = { fear: 1, anger: 2, obsession: 3 }[name] ?? 0;
      emotionTarget = Math.min(1, Math.max(0, value));
    },
    update(dt) {
      uniforms.blood.value += (bloodTarget - uniforms.blood.value) * (1 - Math.exp(-dt / .06));
      uniforms.emotion.value += (emotionTarget - uniforms.emotion.value) * (1 - Math.exp(-dt / .12));
    },
    render(renderer) {
      if (!tint.visible || Math.max(uniforms.blood.value, uniforms.emotion.value) < .0001) return;
      const clear = renderer.autoClear, reset = renderer.info.autoReset;
      renderer.autoClear = false;
      renderer.info.autoReset = false;
      try { renderer.render(scene, camera); }
      finally { renderer.autoClear = clear; renderer.info.autoReset = reset; }
    },
    get state() { return { blood: uniforms.blood.value, emotion: uniforms.emotion.value, kind: uniforms.kind.value }; },
  };
  return tint;
}
