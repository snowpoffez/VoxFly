import * as THREE from 'three'
import { lngLatToMercator } from '../utils/mercator'

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

      const bodyMat = new THREE.MeshBasicMaterial({ color: 0xf0f0f0 })
      const accentMat = new THREE.MeshBasicMaterial({ color: 0x2255cc })
      const darkMat = new THREE.MeshBasicMaterial({ color: 0x4a4a4a })
      const noseMat = new THREE.MeshBasicMaterial({ color: 0x888888 })

      this.material = bodyMat
      this._accentMat = accentMat
      this._noseMat = noseMat

      const g = new THREE.Group()
      const sweep = 0.35

      // Fuselage (smoother, more cylindrical)
      const fuseGeom = new THREE.CylinderGeometry(0.000028, 0.000045, 0.0002, 10)
      fuseGeom.rotateZ(-Math.PI / 2)
      g.add(new THREE.Mesh(fuseGeom, bodyMat))

      // Elongated nose cone
      const noseGeom = new THREE.ConeGeometry(0.000045, 0.00007, 10)
      noseGeom.rotateZ(-Math.PI / 2)
      const nose = new THREE.Mesh(noseGeom, noseMat)
      nose.position.x = 0.000135
      g.add(nose)

      // Tail cone
      const tailGeom = new THREE.ConeGeometry(0.000028, 0.00004, 10)
      tailGeom.rotateZ(Math.PI / 2)
      const tail = new THREE.Mesh(tailGeom, darkMat)
      tail.position.x = -0.00012
      g.add(tail)

      // --- Right wing (swept, with tip accent + winglet) ---
      const wingGeom = new THREE.BoxGeometry(0.00006, 0.00009, 0.000005)
      const tipGeom = new THREE.BoxGeometry(0.000012, 0.00002, 0.000006)
      const wlGeom = new THREE.BoxGeometry(0.000008, 0.000004, 0.000018)

      const wingR = new THREE.Mesh(wingGeom, bodyMat)
      wingR.position.set(0.000005, 0.000045, 0)
      wingR.rotation.z = sweep
      const tipR = new THREE.Mesh(tipGeom, accentMat)
      tipR.position.set(-0.000015, 0.000045, 0)
      wingR.add(tipR)
      const wlR = new THREE.Mesh(wlGeom, accentMat)
      wlR.position.set(-0.000015, 0.000045, 0.000012)
      wingR.add(wlR)
      g.add(wingR)

      // --- Left wing ---
      const wingL = new THREE.Mesh(wingGeom, bodyMat)
      wingL.position.set(0.000005, -0.000045, 0)
      wingL.rotation.z = -sweep
      const tipL = new THREE.Mesh(tipGeom, accentMat)
      tipL.position.set(-0.000015, -0.000045, 0)
      wingL.add(tipL)
      const wlL = new THREE.Mesh(wlGeom, accentMat)
      wlL.position.set(-0.000015, -0.000045, 0.000012)
      wingL.add(wlL)
      g.add(wingL)

      // Tail vertical stabilizer (swept)
      const tvGeom = new THREE.BoxGeometry(0.000035, 0.000004, 0.000065)
      const tv = new THREE.Mesh(tvGeom, bodyMat)
      tv.position.set(-0.0001, 0, 0.000038)
      tv.rotation.z = 0.25
      g.add(tv)

      // Tail horizontal stabilizers (swept)
      const thGeom = new THREE.BoxGeometry(0.00002, 0.00004, 0.000003)
      const thR = new THREE.Mesh(thGeom, darkMat)
      thR.position.set(-0.0001, 0.000022, 0)
      thR.rotation.z = 0.3
      const thL = new THREE.Mesh(thGeom, darkMat)
      thL.position.set(-0.0001, -0.000022, 0)
      thL.rotation.z = -0.3
      g.add(thR, thL)

      this.arrow = g
      this.scene.add(this.arrow)
    },

    render(gl, matrix) {
      this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix)

      const merc = lngLatToMercator(state.lng, state.lat, 0)
      this.arrow.position.set(merc.x, merc.y, merc.z)
      this.arrow.rotation.z = -state.headingRad

      // Scale plane to a consistent ~35px on-screen size across zoom levels.
      // Uses map.project() to compute the real mercator-to-pixel ratio so the
      // model never grows absurdly large at low zoom.
      const p1 = this.map.project([state.lng, state.lat])
      const p2 = this.map.project([state.lng + 1, state.lat])
      const pxPerMerc = 360 * Math.abs(p2.x - p1.x)
      const s = Math.min(35 / (0.00025 * pxPerMerc), 20)
      this.arrow.scale.set(s, s, s)

      if (state.turbulenceActive) {
        this.arrow.position.x += (Math.random() - 0.5) * 0.000004 * state.turbIntensity * s
        this.arrow.position.y += (Math.random() - 0.5) * 0.000004 * state.turbIntensity * s
      }

      const isTurb = state.turbulenceActive
      this.material.color.setHex(isTurb ? 0xff4422 : 0xf0f0f0)
      this._accentMat.color.setHex(isTurb ? 0xff8844 : 0x2255cc)
      this._noseMat.color.setHex(isTurb ? 0xcc3333 : 0x888888)

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
