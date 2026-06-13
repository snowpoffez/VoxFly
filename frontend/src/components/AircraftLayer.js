import * as THREE from 'three'
import { lngLatToMercator } from '../utils/mercator'

// Mapbox custom layer that draws a 3D aircraft arrow with Three.js, sharing the
// map's WebGL context. Returns { layer, update } — call update() whenever the
// flight state changes so the next render frame reflects it.
export function createAircraftLayer(initial = {}) {
  const state = {
    lng: initial.longitude ?? -79.63,
    lat: initial.latitude ?? 43.68,
    headingRad: ((initial.heading ?? 0) * Math.PI) / 180,
    turbulenceActive: !!initial.turbulence,
    turbIntensity: 1,
  }

  const layer = {
    id: 'aircraft-arrow',
    type: 'custom',
    renderingMode: '3d',

    onAdd(map, gl) {
      this.map = map
      this.renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      })
      this.renderer.autoClear = false

      this.scene = new THREE.Scene()
      this.camera = new THREE.Camera()

      // Arrow: a cone pointing along +X (heading), with two swept-back fins.
      const group = new THREE.Group()

      const body = new THREE.ConeGeometry(0.00006, 0.00025, 8)
      body.rotateZ(-Math.PI / 2)
      this.material = new THREE.MeshBasicMaterial({ color: 0xffffff })
      group.add(new THREE.Mesh(body, this.material))

      const fin = new THREE.BoxGeometry(0.00008, 0.000015, 0.00018)
      const finL = new THREE.Mesh(fin, this.material)
      finL.position.set(-0.00007, 0, 0.00007)
      const finR = new THREE.Mesh(fin, this.material)
      finR.position.set(-0.00007, 0, -0.00007)
      group.add(finL, finR)

      this.arrow = group
      this.scene.add(this.arrow)
    },

    render(gl, matrix) {
      this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix)

      const merc = lngLatToMercator(state.lng, state.lat, 0)
      this.arrow.position.set(merc.x, merc.y, merc.z)
      this.arrow.rotation.z = -state.headingRad

      if (state.turbulenceActive) {
        this.arrow.position.x += (Math.random() - 0.5) * 0.000004 * state.turbIntensity
        this.arrow.position.y += (Math.random() - 0.5) * 0.000004 * state.turbIntensity
      }

      this.material.color.set(state.turbulenceActive ? 0xff4422 : 0xffffff)

      this.renderer.resetState()
      this.renderer.render(this.scene, this.camera)
      this.map.triggerRepaint()
    },
  }

  function update(next = {}) {
    if (next.longitude != null) state.lng = next.longitude
    if (next.latitude != null) state.lat = next.latitude
    if (next.heading != null) state.headingRad = (next.heading * Math.PI) / 180
    if (next.turbulence != null) state.turbulenceActive = next.turbulence
  }

  return { layer, update }
}
