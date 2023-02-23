import { interpolatePRGn } from 'd3-scale-chromatic';
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
  mesh?: THREE.Mesh;
}

const sphereGeometry = new THREE.SphereGeometry(0.001, 32, 32);

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
  points: { [key: string]: SurfacePoint } = {};
  debugGroup = new THREE.Group();

  constructor(transform: XRRigidTransform) {
    this.transform = transform;
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

  testPoint(
    x: number,
    z: number,
    camera: THREE.Camera,
    depthInfo: any
  ): number {
    // TODO: make resolution configurable
    const resolution = 0.02;

    const cacheX = Math.round(x / resolution);
    const cacheZ = Math.round(z / resolution);

    const pointKey = `${cacheX},${cacheZ}`;

    let cachedPoint = this.points[pointKey];
    if (cachedPoint?.pValue > 0.9) {
      return cachedPoint.pValue;
    }

    if (!cachedPoint) {
      const sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0x666666,
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      const sphereWorldPosition = new THREE.Vector3(
        cacheX * resolution,
        0,
        cacheZ * resolution
      ).applyMatrix4(this.threeMatrix());
      sphere.position.copy(sphereWorldPosition);
      this.debugGroup.add(sphere);

      cachedPoint = {
        samples: [],
        pValue: 0,
        mesh: sphere,
      };
      this.points[pointKey] = cachedPoint;
    }

    // Important note: while we cache at cacheX and cacheZ, we test at x
    // and z
    const worldPosition = new THREE.Vector3(x, 0, z).applyMatrix4(
      this.threeMatrix()
    );

    const idealDepth = worldPosition.distanceTo(camera.position);

    // Convert to screen coords
    const cameraPosition = worldPosition.clone().project(camera);
    const screenX = (cameraPosition.x + 1) / 2;
    const screenY = 1 - (cameraPosition.y + 1) / 2;
    if (screenX < 0 || screenX > 1 || screenY < 0 || screenY > 1) {
      return 0;
    }
    const actualDepth = depthInfo.getDepthInMeters(screenX, screenY);

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
    if (cachedPoint.samples.length > 50) {
      cachedPoint.samples.sort((a, b) => a.idealDepth - b.idealDepth);
    }
    const samples = cachedPoint.samples
      .slice(0, 100)
      .map((s) => s.adjustedOffset);

    cachedPoint.pValue = jStat(samples).ztest(0);
    if (
      cachedPoint.mesh &&
      cachedPoint.mesh.material instanceof THREE.MeshBasicMaterial
    ) {
      cachedPoint.mesh.material.color = new THREE.Color(
        interpolatePRGn(
          isNaN(cachedPoint.pValue) ? 0xff0000 : cachedPoint.pValue
        )
      );
    }

    return cachedPoint.pValue;
  }

  clear() {
    this.points = {};
    this.debugGroup.clear();
  }
}
