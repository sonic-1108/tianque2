// The finish: bloom on bright things (snow in the sun, fire, gold), filmic tone mapping, a soft vignette.
// A scrub pass first, so one bad pixel can't be blurred over the whole screen by the bloom (the old game's black screens).
import * as THREE from 'three';
import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';
import { Pass, ToneMappingMode } from 'postprocessing';

class SanitizePass extends Pass {
  mat: THREE.ShaderMaterial;
  constructor() {
    super('SanitizePass');
    this.mat = new THREE.ShaderMaterial({
      uniforms: { inputBuffer: { value: null } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: `uniform sampler2D inputBuffer; varying vec2 vUv;
        float ok(float v) { return (v >= 0.0 && v <= 2000.0) ? v : (v > 2000.0 ? 2000.0 : 0.0); }
        void main() { vec4 c = texture2D(inputBuffer, vUv); gl_FragColor = vec4(ok(c.r), ok(c.g), ok(c.b), 1.0); }`,
      depthWrite: false,
      depthTest: false,
    });
    this.fullscreenMaterial = this.mat;
  }
  render(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget, outputBuffer: THREE.WebGLRenderTarget) {
    this.mat.uniforms.inputBuffer.value = inputBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.render(this.scene, this.camera);
  }
}
const sanitize = new SanitizePass();

export function Post() {
  return (
    <EffectComposer multisampling={2}>
      <primitive object={sanitize} />
      <Bloom mipmapBlur intensity={0.55} luminanceThreshold={0.85} luminanceSmoothing={0.25} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.38} darkness={0.32} />
    </EffectComposer>
  );
}
