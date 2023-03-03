import { jStat } from 'jstat';
import * as THREE from 'three';

export interface SurfacePointSample {
  idealDepth: number;
  actualDepth: number;
  adjustedOffset: number;
}

export interface SurfacePoint {
  samples: SurfacePointSample[];
  pValue: number;
  debugMatrix: THREE.Matrix4;
  debugColor: THREE.Color;
}

const sphereGeometry = new THREE.CircleGeometry(0.0005, 4).rotateX(-Math.PI / 2);
const sphereMaterial = new THREE.MeshBasicMaterial();

const getDebugColor = (pValue: number) => {
  if (pValue < 0.4) return 0x7b3294;
  if (pValue < 0.6) return 0xc2a5cf;
  if (pValue < 0.8) return 0xf7f7f7;
  if (pValue < 0.9) return 0xa6dba0;
  return 0x008837;
};

export default class SurfaceHandler {
  surfaces: Surface[] = [];
  debugGroup = new THREE.Group();

  setDebug(debug: boolean) {
    this.debugGroup.visible = debug;
  }

  getSurface(transform: XRRigidTransform) {
    for (const surface of this.surfaces) {
      const yOffset = surface.transform.position.y - transform.position.y;
      // TODO: make tolerance configurable?
      if (Math.abs(yOffset) < 0.2) {
        return surface;
      }
    }

    const surface = new Surface(transform);
    this.surfaces.push(surface);
    this.debugGroup.add(surface.debugGroup);
    return surface;
  }

  clear() {
    this.surfaces.splice(0, this.surfaces.length);
    this.debugGroup.clear();
  }
}

export class Surface {
  transform: XRRigidTransform;
  plane: THREE.Plane;
  points: { [key: string]: SurfacePoint } = {};
  debugGroup = new THREE.Group();

  constructor(transform: XRRigidTransform) {
    this.transform = transform;
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0)).applyMatrix4(
      this.threeMatrix()
    );
  }

  private threeMatrixCache?: THREE.Matrix4;
  private threeMatrix() {
    if (!this.threeMatrixCache) {
      this.threeMatrixCache = new THREE.Matrix4().fromArray(
        this.transform.matrix
      );
    }

    return this.threeMatrixCache;
  }

  private inverseThreeMatrixCache?: THREE.Matrix4;
  private inverseThreeMatrix() {
    if (!this.inverseThreeMatrixCache) {
      this.inverseThreeMatrixCache = this.threeMatrix().clone().invert();
    }

    return this.inverseThreeMatrixCache;
  }

  // TODO: make resolution configurable
  private readonly resolution = 0.01;

  private updateDebugGroup() {
    if (!this.debugGroup.visible || !this.debugGroup.parent?.parent) {
      return;
    }

    const pointsArray = Object.values(this.points);

    let debugPoints = this.debugGroup.children[0];
    if (
      !debugPoints ||
      !(debugPoints instanceof THREE.InstancedMesh) ||
      debugPoints.count < pointsArray.length
    ) {
      if (debugPoints) {
        this.debugGroup.remove(debugPoints);
      }

      debugPoints = new THREE.InstancedMesh(
        sphereGeometry,
        sphereMaterial,
        pointsArray.length * 1.5
      );
      this.debugGroup.add(debugPoints);
    }

    if (!(debugPoints instanceof THREE.InstancedMesh)) throw new Error('???');

    for (let i = 0; i < pointsArray.length; i++) {
      const point = pointsArray[i];
      debugPoints.setMatrixAt(i, point.debugMatrix);
      debugPoints.setColorAt(i, point.debugColor);
    }

    debugPoints.instanceMatrix.needsUpdate = true;
    if (!debugPoints.instanceColor) throw new Error('???');
    debugPoints.instanceColor.needsUpdate = true;
  }

  private getCachedPoint(x: number, z: number) {
    const cacheX = Math.round(x / this.resolution);
    const cacheZ = Math.round(z / this.resolution);

    const pointKey = `${cacheX},${cacheZ}`;

    let cachedPoint = this.points[pointKey];

    if (!cachedPoint) {
      const dummyObj = new THREE.Object3D();
      dummyObj.position
        .set(cacheX * this.resolution, 0, cacheZ * this.resolution)
        .applyMatrix4(this.threeMatrix());
      dummyObj.updateMatrix();

      cachedPoint = {
        samples: [],
        pValue: 0,
        debugMatrix: dummyObj.matrix,
        debugColor: new THREE.Color(),
      };
      this.points[pointKey] = cachedPoint;
    }

    return cachedPoint;
  }

  testPoint(x: number, z: number): number {
    const { pValue } = this.getCachedPoint(x, z);
    return isNaN(pValue) ? 1 : pValue;
  }

  learnDepthInfo(camera: THREE.Camera, depthInfo: any) {
    const raycaster = new THREE.Raycaster();
    const localPosition = new THREE.Vector3();
    const worldPosition = new THREE.Vector3();

    for (let x = 0; x < depthInfo.width; x++) {
      for (let y = 0; y < depthInfo.height; y++) {
        // Performance is too bad to test everything on every frame :(
        if (Math.random() < 0.9) continue;

        const screenX = (x / depthInfo.width) * 2 - 1;
        const screenY = (y / depthInfo.height) * 2 - 1;
        raycaster.setFromCamera({ x: screenX, y: screenY }, camera);
        raycaster.ray.intersectPlane(this.plane, worldPosition);
        localPosition
          .copy(worldPosition)
          .applyMatrix4(this.inverseThreeMatrix());

        const cachedPoint = this.getCachedPoint(
          localPosition.x,
          localPosition.z
        );

        if (cachedPoint.pValue > 0.9) {
          continue;
        }

        const idealDepth = worldPosition.distanceTo(camera.position);

        const actualDepth = depthInfo.getDepthInMeters(
          screenX / 2 + 0.5,
          0.5 - screenY / 2
        );

        let depthOffset = Math.abs(actualDepth - idealDepth);
        const depthOffsetThreshold = idealDepth / 5;
        if (depthOffset > depthOffsetThreshold) {
          depthOffset -= depthOffsetThreshold;
        } else if (depthOffset < -depthOffsetThreshold) {
          depthOffset += depthOffsetThreshold;
        } else {
          depthOffset = 0;
        }
        cachedPoint.samples.push({
          idealDepth,
          actualDepth,
          adjustedOffset: depthOffset,
        });

        // Calculations are less accurate when further away so if the camera
        // gets closer we want that to take priority over the less accurate
        // samples
        if (cachedPoint.samples.length > 30) {
          cachedPoint.samples = cachedPoint.samples
            .sort((a, b) => a.idealDepth - b.idealDepth)
            .slice(0, 30);
        }
        const samples = cachedPoint.samples.map((s) => s.adjustedOffset);

        cachedPoint.pValue = jStat(samples).ztest(0);
        cachedPoint.debugColor.set(getDebugColor(cachedPoint.pValue));
      }
    }

    this.updateDebugGroup();
  }

  clear() {
    this.points = {};
    this.debugGroup.clear();
  }
}
