import { Ray, Vector3 } from "three"

export class Cone {

    v: Vector3;
    axis: Vector3;
    theta: number;
    inf: number;
    sup: number;
    cosTheta: number;

    /**
     *  @param v The cone origin
     *  @param axis The axis, normalized.
     *  @param theta The cone angle
     *  @param sup The maximum distance from v in the axis direction (truncated cone). If null or undefined, will be +infinity
     *  @param inf The minimum distance from v in the axis direction (truncated cone). if null or undefined, will be 0
     */
    constructor(v?: Vector3, axis?: Vector3, theta?: number, inf?: number, sup?: number) {

        this.v = v || new Vector3();
        this.axis = axis || new Vector3(1, 0, 0);
        this.theta = theta || 0;
        this.inf = inf || 0;
        this.sup = sup || +Infinity;

        this.cosTheta = Math.cos(theta || 0);
    }

    set(v: Vector3, axis: Vector3, theta: number, inf: number, sup: number) {

        this.v.copy(v);
        this.axis.copy(axis);
        this.theta = theta;
        this.inf = inf || 0;
        this.sup = sup || +Infinity;

        this.cosTheta = Math.cos(theta);

        return this;

    }

    clone() {
        return (new Cone()).copy(this);
    }

    copy(cone: Cone): Cone {

        this.v.copy(cone.v);
        this.axis.copy(cone.axis);
        this.theta = cone.theta;
        this.inf = cone.inf;
        this.sup = cone.sup;

        this.cosTheta = Math.cos(this.theta);

        return this;

    }

    empty() {

        return (this.theta <= 0 || this.inf >= this.sup);

    }

    getBoundingBox(target: Vector3) {
        throw "not implemented yet, todo";
    }

    equals(cone: Cone): boolean {

        return cone.v.equals(this.v) && cone.axis.equals(this.axis) && cone.theta === this.theta && cone.inf === this.inf && cone.sup === this.sup;

    }
}

declare module "three"{
    interface Ray {
        intersectCone(cone: Cone, target: Vector3): Vector3 | null;
    }
}

/**
 *
 * Compute intersections of a ray with a cone.
 * For more on this algorithm : http://www.geometrictools.com/Documentation/IntersectionLineCone.pdf
 *
 * @param cone is a truncated cone and must must define :
 *      v the singular point
 *      axis the cone direction
 *      inf >= 0 all points P such that Dot(axis,P-v) < inf are not considered in the cone
 *      sup > 0 all points P such that Dot(axis,P-v) > sup are not considered in the cone
 *
 * @param target Where to save the resulting hit point, if any.
 * @return {Vector3} The first hit point if any, null otherwise.
 *
 */
Ray.prototype.intersectCone = function () {
    // static variables for the function
    var E = new Vector3();
    var target2 = new Vector3();

    return function (cone: Cone, target: Vector3): Vector3 | null {
        // Set up the quadratic Q(t) = c2*t^2 + 2*c1*t + c0 that corresponds to
        // the cone.  Let the vertex be V, the unit-length direction vector be A,
        // and the angle measured from the cone axis to the cone wall be Theta,
        // and define g = cos(Theta).  A point X is on the cone wall whenever
        // Dot(A,(X-V)/|X-V|) = g.  Square this equation and factor to obtain
        //   (X-V)^T * (A*A^T - g^2*I) * (X-V) = 0
        // where the superscript T denotes the transpose operator.  This defines
        // a double-sided cone.  The line is L(t) = P + t*D, where P is the line
        // origin and D is a unit-length direction vector.  Substituting
        // X = L(t) into the cone equation above leads to Q(t) = 0.  Since we
        // want only intersection points on the single-sided cone that lives in
        // the half-space pointed to by A, any point L(t) generated by a root of
        // Q(t) = 0 must be tested for Dot(A,L(t)-V) >= 0.

        var cos_angle = cone.cosTheta;
        var AdD = cone.axis.dot(this.direction);
        var cos_sqr = cos_angle * cos_angle;
        E.subVectors(this.origin, cone.v);
        var AdE = cone.axis.dot(E);
        var DdE = this.direction.dot(E);
        var EdE = E.dot(E);
        var c2 = AdD * AdD - cos_sqr;
        var c1 = AdD * AdE - cos_sqr * DdE;
        var c0 = AdE * AdE - cos_sqr * EdE;
        var dot;

        // Solve the quadratic.  Keep only those X for which Dot(A,X-V) >= 0.
        if (Math.abs(c2) >= 0) {
            // c2 != 0
            var discr = c1 * c1 - c0 * c2;
            if (discr < 0) {
                // Q(t) = 0 has no real-valued roots.  The line does not
                // intersect the double-sided cone.
                return null;
            }
            else if (discr > 0) {
                // Q(t) = 0 has two distinct real-valued roots.  However, one or
                // both of them might intersect the portion of the double-sided
                // cone "behind" the vertex.  We are interested only in those
                // intersections "in front" of the vertex.
                var root = Math.sqrt(discr);
                var invC2 = 1 / c2;
                var quantity = 0;

                var t = (-c1 - root) * invC2;
                if (t > 0) {
                    this.at(t, target);

                    E.subVectors(target, cone.v);
                    dot = E.dot(cone.axis);
                    if (dot > cone.inf && dot < cone.sup) {
                        quantity++;
                    }
                }

                var t2 = (-c1 + root) * invC2;
                if (t2 > 0 && t2 < t) {
                    this.at(t2, target2);

                    E.subVectors(target2, cone.v);
                    dot = E.dot(cone.axis);
                    if (dot > cone.inf && dot < cone.sup) {
                        quantity++;
                        target.copy(target2);
                    }
                }

                if (quantity == 2) {
                    // The line intersects the single-sided cone in front of the
                    // vertex twice.
                    return target;
                }
                else if (quantity == 1) {
                    // The line intersects the single-sided cone in front of the
                    // vertex once.  The other intersection is with the
                    // single-sided cone behind the vertex.
                    return target;
                }
                else {
                    // The line intersects the single-sided cone behind the vertex
                    // twice.
                    return null;
                }
            }
            else {
                // One repeated real root (line is tangent to the cone).
                var t = c1 / c2;
                this.at(t, target);

                E.subVectors(target, cone.v);
                dot = E.dot(cone.axis);
                if (dot > cone.inf && dot < cone.sup) {
                    return target;
                }
                else {
                    return null;
                }
            }
        }
        else if (Math.abs(c1) >= 0) {
            // c2 = 0, c1 != 0 (D is a direction vector on the cone boundary)

            var t = 0.5 * c0 / c1;
            this.at(t, target);

            E.subVectors(target, cone.v);
            dot = E.dot(cone.axis);
            if (dot > cone.inf && dot < cone.sup) {
                return target;
            }
            else {
                return null;
            }
        }
        else {
            // c2 = c1 = 0, c0 != 0
            // OR
            // c2 = c1 = c0 = 0, cone contains ray V+t*D where V is cone vertex
            // and D is the line direction.
            return null;
        }
    };
}();