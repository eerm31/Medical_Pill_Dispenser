"""Bounded profile solids and artifact-only QA; millimeters, right-handed axes.

No CSG or CAD certification. Profiles must be simple counterclockwise polygons;
hollow lofts support strictly nested, matched convex profiles only.
"""
from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass

IDENTITY = (1., 0., 0., 0., 1., 0., 0., 0., 1., 0., 0., 0.)
NUMERICAL_TOLERANCE_MM = .01


@dataclass(frozen=True)
class Mesh:
    vertices: tuple[tuple[float, float, float], ...]
    triangles: tuple[tuple[int, int, int], ...]


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def sub(a, b):
    return tuple(a[i]-b[i] for i in range(3))


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def validate_transform(t):
    if len(t) != 12 or not all(math.isfinite(v) for v in t):
        raise ValueError("placement must contain 12 finite Core coefficients")
    if dot(t[:3], cross(t[3:6], t[6:9])) <= 1e-12:
        raise ValueError("singular/reflected placement is unsupported")


def translation(x, y, z):
    return IDENTITY[:9] + (x, y, z)


def transform_point(p, t=IDENTITY):
    return tuple(sum(p[j]*t[j*3+i] for j in range(3))+t[9+i] for i in range(3))


def canonical_to_three(point):
    """Map canonical right-handed XYZ to Three world (x,z,-y) exactly once."""
    x, y, z = point
    return (x, z, -y)


def three_to_canonical(point):
    """Inverse of canonical_to_three for positions and direction vectors."""
    x, y, z = point
    return (x, -z, y)


def shader_matrix(t=IDENTITY):
    """Core row-vector 4x3 -> OpenGL column-vector, column-major 4x4."""
    validate_transform(t)
    return (t[0], t[1], t[2], 0., t[3], t[4], t[5], 0.,
            t[6], t[7], t[8], 0., t[9], t[10], t[11], 1.)


def bounds(mesh, t=IDENTITY):
    points = [transform_point(p, t) for p in mesh.vertices]
    return (tuple(min(p[i] for p in points) for i in range(3)),
            tuple(max(p[i] for p in points) for i in range(3)))


def union_bounds(boxes):
    boxes = tuple(boxes)
    return (tuple(min(b[0][i] for b in boxes) for i in range(3)),
            tuple(max(b[1][i] for b in boxes) for i in range(3)))


def rectangle(width, depth):
    if not all(math.isfinite(v) and v > 0 for v in (width, depth)):
        raise ValueError("rectangle dimensions must be finite positive")
    return ((-width/2, -depth/2), (width/2, -depth/2),
            (width/2, depth/2), (-width/2, depth/2))


def _turn(a, b, c):
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])


def _profile(profile):
    p = tuple(tuple(float(v) for v in point) for point in profile)
    if len(p) < 3 or any(len(v) != 2 or not all(math.isfinite(x) for x in v) for v in p):
        raise ValueError("profile needs at least three finite 2D points")
    if len(set(p)) != len(p):
        raise ValueError("duplicate profile vertex")
    n = len(p)
    for i in range(n):
        if abs(_turn(p[i-1], p[i], p[(i+1)%n])) < 1e-12:
            raise ValueError("collinear profile edge")
        for j in range(i+1, n):
            if j in (i, (i+1)%n) or i == (j+1)%n:
                continue
            a,b,c,d = p[i],p[(i+1)%n],p[j],p[(j+1)%n]
            overlap = all(max(min(a[k],b[k]),min(c[k],d[k])) <= min(max(a[k],b[k]),max(c[k],d[k])) for k in range(2))
            if overlap and _turn(a,b,c)*_turn(a,b,d) <= 0 and _turn(c,d,a)*_turn(c,d,b) <= 0:
                raise ValueError("self-intersecting profile")
    area = sum(p[i][0]*p[(i+1)%n][1]-p[(i+1)%n][0]*p[i][1] for i in range(n))
    if area <= 1e-12:
        raise ValueError("profile must have positive counterclockwise area")
    return p


def _triangulate(p):
    remaining = list(range(len(p)))
    triangles = []
    while len(remaining) > 3:
        for k, b in enumerate(remaining):
            a,c = remaining[k-1],remaining[(k+1)%len(remaining)]
            if _turn(p[a],p[b],p[c]) <= 0:
                continue
            if any(all(_turn(p[u],p[v],p[q]) >= -1e-12 for u,v in ((a,b),(b,c),(c,a)))
                   for q in remaining if q not in (a,b,c)):
                continue
            triangles.append((a,b,c))
            remaining.pop(k)
            break
        else:
            raise ValueError("profile cannot be triangulated")
    triangles.append(tuple(remaining))
    return triangles


def extrude(profile, height):
    p = _profile(profile)
    if not math.isfinite(height) or height <= 0:
        raise ValueError("extrusion height must be finite positive")
    n = len(p)
    vertices = tuple((x,y,z) for z in (0.,float(height)) for x,y in p)
    triangles = [(c,b,a) for a,b,c in _triangulate(p)]
    triangles += [(a+n,b+n,c+n) for a,b,c in _triangulate(p)]
    for i in range(n):
        j = (i+1)%n
        triangles.extend(((i,j,j+n),(i,j+n,i+n)))
    mesh = Mesh(vertices,tuple(triangles))
    validate_mesh(mesh)
    return mesh


def hollow_loft(outer_bottom, outer_top, inner_bottom, inner_top, height):
    profiles = tuple(_profile(p) for p in (outer_bottom,outer_top,inner_bottom,inner_top))
    n = len(profiles[0])
    if any(len(p) != n for p in profiles) or not math.isfinite(height) or height <= 0:
        raise ValueError("loft needs matched profiles and finite positive height")
    for outer,inner in ((profiles[0],profiles[2]),(profiles[1],profiles[3])):
        if any(_turn(outer[i-1],outer[i],outer[(i+1)%n]) <= 0 for i in range(n)):
            raise ValueError("hollow loft requires convex outer profiles")
        if any(_turn(outer[i],outer[(i+1)%n],q) <= 0 for i in range(n) for q in inner):
            raise ValueError("inner profile must be strictly inside outer profile")
    vertices = tuple((x,y,z) for p,z in zip(profiles,(0.,height,0.,height)) for x,y in p)
    triangles = []
    def quad(a,b,c,d):
        triangles.extend(((a,b,c),(a,c,d)))
    for i in range(n):
        j = (i+1)%n
        quad(i,j,n+j,n+i)                   # outer wall
        quad(2*n+j,2*n+i,3*n+i,3*n+j)       # inner wall
        quad(n+i,n+j,3*n+j,3*n+i)           # upper rim
        quad(j,i,2*n+i,2*n+j)               # lower rim
    mesh = Mesh(vertices,tuple(triangles))
    validate_mesh(mesh)
    return mesh


def validate_mesh(mesh):
    if not mesh.vertices or not mesh.triangles:
        raise ValueError("empty mesh")
    if any(len(p) != 3 or not all(math.isfinite(v) for v in p) for p in mesh.vertices):
        raise ValueError("nonfinite mesh coordinate")
    edges = Counter()
    volume = 0.
    for tri in mesh.triangles:
        if len(tri) != 3 or len(set(tri)) != 3 or any(not isinstance(i,int) or i < 0 or i >= len(mesh.vertices) for i in tri):
            raise ValueError("invalid triangle indices")
        a,b,c = (mesh.vertices[i] for i in tri)
        normal = cross(sub(b,a),sub(c,a))
        if dot(normal,normal) <= 1e-20:
            raise ValueError("zero-area triangle")
        volume += dot(a,cross(b,c))/6
        for u,v in zip(tri,tri[1:]+tri[:1]):
            edges[(u,v)] += 1
    if any(count != 1 or edges[(v,u)] != 1 for (u,v),count in edges.items()):
        raise ValueError("mesh is not closed with opposite two-use edges")
    if volume <= 1e-12:
        raise ValueError("nonpositive signed mesh volume")
    return {"status":"PASS", "signed_volume_mm3":volume,
            "vertices":len(mesh.vertices), "triangles":len(mesh.triangles),
            "scope":"bounded artifact topology only, not manufacturing validation"}


def vertex_normals(mesh):
    result = [[0.,0.,0.] for _ in mesh.vertices]
    for a,b,c in mesh.triangles:
        normal = cross(sub(mesh.vertices[b],mesh.vertices[a]),sub(mesh.vertices[c],mesh.vertices[a]))
        for i in (a,b,c):
            for axis in range(3):
                result[i][axis] += normal[axis]
    return tuple(tuple(v/math.sqrt(dot(n,n)) for v in n) for n in result)


def box_mesh(size):
    """Build a centered, closed rectangular solid."""
    x, y, z = (float(value) / 2 for value in size)
    vertices = ((-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),
                (-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z))
    triangles = ((0,2,1),(0,3,2),(4,5,6),(4,6,7),
                 (0,1,5),(0,5,4),(1,2,6),(1,6,5),
                 (2,3,7),(2,7,6),(3,0,4),(3,4,7))
    mesh = Mesh(vertices, triangles)
    validate_mesh(mesh)
    return mesh


def cylinder_mesh(radius, height, segments=20):
    """Build a deterministic closed cylinder centered on local Z."""
    if not math.isfinite(radius) or radius <= 0 or not math.isfinite(height) or height <= 0 or segments < 6:
        raise ValueError("cylinder needs positive finite dimensions and at least six segments")
    ring = tuple((radius*math.cos(2*math.pi*i/segments), radius*math.sin(2*math.pi*i/segments)) for i in range(segments))
    vertices = [(x,y,z) for z in (-height/2,height/2) for x,y in ring]
    bottom_center, top_center = len(vertices), len(vertices)+1
    vertices.extend(((0.,0.,-height/2),(0.,0.,height/2)))
    triangles = []
    for i in range(segments):
        j = (i+1)%segments
        triangles.extend(((i,j,segments+j),(i,segments+j,segments+i),
                          (bottom_center,j,i),(top_center,segments+i,segments+j)))
    mesh = Mesh(tuple(vertices), tuple(triangles))
    validate_mesh(mesh)
    return mesh


def ring_mesh(outer_radius, inner_radius, height, segments=32):
    """Closed annular cylinder around the central post, local Z axis."""
    if (not all(math.isfinite(v) and v > 0 for v in (outer_radius, inner_radius, height))
            or inner_radius >= outer_radius or segments < 8):
        raise ValueError("ring needs 0 < inner radius < outer radius and finite height")
    vertices=[]
    for radius,z in ((outer_radius,-height/2),(outer_radius,height/2),
                     (inner_radius,-height/2),(inner_radius,height/2)):
        vertices.extend((radius*math.cos(2*math.pi*i/segments),
                         radius*math.sin(2*math.pi*i/segments),z)
                        for i in range(segments))
    ob,ot,ib,it=0,segments,2*segments,3*segments
    triangles=[]
    for i in range(segments):
        j=(i+1)%segments
        triangles.extend(((ob+i,ob+j,ot+j),(ob+i,ot+j,ot+i),
                          (ib+j,ib+i,it+i),(ib+j,it+i,it+j),
                          (ot+i,ot+j,it+j),(ot+i,it+j,it+i),
                          (ob+j,ob+i,ib+i),(ob+j,ib+i,ib+j)))
    mesh=Mesh(tuple(vertices),tuple(triangles));validate_mesh(mesh);return mesh


def rod_mesh(length, radius, segments=12):
    return cylinder_mesh(radius, length, segments)


def helix_mesh(radius, height, turns, tube_radius=.2, segments=48, sides=8):
    """Create a deterministic closed tube around a simple z-axis helix."""
    if min(radius, height, turns, tube_radius) <= 0 or not all(math.isfinite(v) for v in (radius,height,turns,tube_radius)):
        raise ValueError("helix dimensions must be finite positive")
    if segments < 12 or sides < 4:
        raise ValueError("helix tessellation is below the supported minimum")
    vertices = []
    for i in range(segments+1):
        t = 2*math.pi*turns*i/segments
        center = (radius*math.cos(t), radius*math.sin(t), height*i/segments-height/2)
        radial = (math.cos(t), math.sin(t), 0.)
        tangent = (-math.sin(t), math.cos(t), height/(2*math.pi*turns*radius))
        tangent_len = math.sqrt(dot(tangent,tangent))
        tangent = tuple(v/tangent_len for v in tangent)
        normal = cross(tangent,radial)
        normal_len = math.sqrt(dot(normal,normal))
        normal = tuple(v/normal_len for v in normal)
        for j in range(sides):
            a = 2*math.pi*j/sides
            vertices.append(tuple(center[k]+tube_radius*(math.cos(a)*radial[k]+math.sin(a)*normal[k]) for k in range(3)))
    triangles = []
    for i in range(segments):
        ni = i+1
        for j in range(sides):
            nj = (j+1)%sides
            a,b,c,d = i*sides+j,ni*sides+j,ni*sides+nj,i*sides+nj
            triangles.extend(((a,b,c),(a,c,d)))
    # Close both helical tube ends with winding opposite to the exposed
    # boundary edges of the side quads.
    for ring, reverse in ((0,False),(segments,True)):
        center = tuple(sum(vertices[ring*sides+j][k] for j in range(sides))/sides for k in range(3))
        center_id = len(vertices)
        vertices.append(center)
        for j in range(sides):
            a,b = ring*sides+j,ring*sides+(j+1)%sides
            triangles.append((center_id,b,a) if reverse else (center_id,a,b))
    signed_volume = sum(
        dot(mesh_a, cross(mesh_b, mesh_c)) / 6
        for a, b, c in triangles
        for mesh_a, mesh_b, mesh_c in ((vertices[a], vertices[b], vertices[c]),)
    )
    if signed_volume < 0:
        triangles = [(a, c, b) for a, b, c in triangles]
    mesh = Mesh(tuple(vertices),tuple(triangles))
    validate_mesh(mesh)
    return mesh


def _mesh_from_base_recipe(recipe):
    """Interpret one canonical base recipe; unsupported types fail closed."""
    kind, p = recipe.get("kind"), recipe.get("parameters", {})
    if kind == "box":
        if recipe.get("recipe_id") == "cartridge":
            outer_x,outer_y,_=p["size"]
            inner_x,inner_y=p["channel_size_mm"]
            mesh = hollow_loft(rectangle(outer_x,outer_y),rectangle(outer_x,outer_y),
                               rectangle(inner_x,inner_y),rectangle(inner_x,inner_y),p["size"][2])
            return _translate_mesh(mesh,0.,0.,-p["size"][2]/2)
        return box_mesh(p["size"])
    if kind == "compound_box":
        vertices = []
        triangles = []
        feature_boxes = [item["box"] for item in p.get("fixed_feature_boxes", ())]
        for cx, cy, cz, sx, sy, sz in [*p["boxes"], *feature_boxes]:
            mesh = box_mesh((sx, sy, sz))
            offset = len(vertices)
            vertices.extend((x + cx, y + cy, z + cz) for x, y, z in mesh.vertices)
            triangles.extend(tuple(index + offset for index in face) for face in mesh.triangles)
        result = Mesh(tuple(vertices), tuple(triangles))
        validate_mesh(result)
        return result
    if kind == "slotted_gate":
        width=p["width"];tab_width=p["tab_width"];body=p["body_length"];tab=p["tab_length"]
        bridge=p["end_bridge"];slot=p["slot_width"];slot_length=p["slot_length"];slot_y=p["slot_center_y"];thickness=p["thickness"]
        arm=(tab_width-slot)/2
        lower=(tab-slot_length-2*bridge)/2
        tab_start=slot_y-tab/2
        pieces=(
            (width,body,thickness,0.,tab_start-body/2,0.),
            (tab_width,lower,thickness,0.,tab_start+lower/2,0.),
            (arm,slot_length,thickness,-(slot+arm)/2,slot_y,0.),
            (arm,slot_length,thickness,(slot+arm)/2,slot_y,0.),
            (tab_width,bridge,thickness,0.,slot_y+slot_length/2+bridge/2,0.),
        )
        vertices=[];triangles=[]
        for sx,sy,sz,cx,cy,cz in pieces:
            if sx <= 0 or sy <= 0:
                continue
            box=box_mesh((sx,sy,sz));offset=len(vertices)
            vertices.extend((x+cx,y+cy,z+cz) for x,y,z in box.vertices)
            triangles.extend(tuple(i+offset for i in face) for face in box.triangles)
        result=Mesh(tuple(vertices),tuple(triangles));validate_mesh(result);return result
    if kind == "blade_with_wedge":
        width, length, thickness = p["width"], p["length"], p["thickness"]
        wedge = p["wedge"]
        slot_y = p["slot_center_y"]
        slot_half_y = p["slot_length"] / 2
        tab_start = p["tab_start_y"]
        tab_end = p["tab_end_y"]
        if (recipe.get("recipe_revision") != "fr034-tab-slot-18-22-1" or p.get("stroke_axis") != "local_y"
            or p.get("local_y_start") != "nose_at_closed_tip" or wedge.get("side") != "top" or width <= 0 or length <= 0
                or not 0 < wedge["leading_thickness"] < wedge["body_thickness"] == thickness
                or not 0 < wedge["length"] < length or not 0 <= tab_start < tab_end
                or not 0 < slot_y-slot_half_y or slot_y+slot_half_y > tab_end):
            raise ValueError("invalid or unsupported top-wedge blade profile")
        # Local Y is the clarified short-channel slide axis. Nose local y=0 is
        # the closed tip; +10.4 mm moves it outward to the open endpoint. Local
        # X spans the channel length. The underside remains z=0; only the TOP
        # nose face rises from 0.3 to 1.0 mm over 2.6 mm.
        body_end = tab_start
        ramp_end = wedge["length"]
        profile = ((0., 0.), (body_end, 0.), (body_end, thickness),
                   (ramp_end, thickness), (0., wedge["leading_thickness"]))
        pieces = [_profile_prism_yz(profile, -width/2, width)]
        tab_width = p["tab_width"]
        slot_half_x = p["slot_width"] / 2
        arm_width = (tab_width-p["slot_width"]) / 2
        if arm_width <= 0 or tab_width > width or slot_y-slot_half_y < body_end or slot_y+slot_half_y > tab_end:
            raise ValueError("blade tab slot must be enclosed by tab material")
        for cx in (-(slot_half_x+arm_width/2),slot_half_x+arm_width/2):
            pieces.append(box_mesh((arm_width,p["slot_length"],thickness)))
            pieces[-1]=_translate_mesh(pieces[-1],cx,slot_y,thickness/2)
        for cy, span in ((tab_start+(slot_y-slot_half_y-tab_start)/2,slot_y-slot_half_y-tab_start),
                         (slot_y+slot_half_y+(tab_end-slot_y-slot_half_y)/2,tab_end-slot_y-slot_half_y)):
            if span <= 0:
                raise ValueError("blade pin slot must leave material bridges at both ends")
            pieces.append(box_mesh((tab_width,span,thickness)))
            pieces[-1]=_translate_mesh(pieces[-1],0.,cy,thickness/2)
        return _combine_meshes(pieces)
    if kind == "cylinder":
        return cylinder_mesh(p["radius"],p["height"],p.get("segments",20))
    if kind == "ring":
        ring = ring_mesh(p["outer_radius"],p["inner_radius"],p["height"],p.get("segments",32))
        decks = p.get("socket_decks", ())
        if not decks:
            return ring
        if (len(decks) != 4 or p.get("socket_decks_provenance") != "ASSUMED"
                or p.get("socket_decks_verification_status") != "NOT_VALIDATED"):
            raise ValueError("drum socket decks require four explicitly assumed bounded features")
        pieces = [ring]
        for deck in decks:
            center = deck.get("center_mm", ())
            size = deck.get("size_mm", ())
            angle = deck.get("rotation_z_rad")
            if (len(center) != 3 or len(size) != 3 or not all(math.isfinite(v) for v in (*center, *size, angle))
                    or any(v <= 0 for v in size)):
                raise ValueError("socket deck must have finite center, rotation, and positive finite bounds")
            cs, sn = math.cos(angle), math.sin(angle)
            local = box_mesh(size)
            pieces.append(Mesh(
                tuple((x*cs-y*sn+center[0], x*sn+y*cs+center[1], z+center[2])
                      for x, y, z in local.vertices),
                local.triangles,
            ))
        return _combine_meshes(pieces)
    if kind == "rod":
        return rod_mesh(p["length"],p["radius"])
    if kind == "cone":
        return cone_mesh(p["radius_bottom"],p.get("radius_top",0.0),p["height"],p.get("segments",20))
    if kind == "helix":
        return helix_mesh(p["radius"],p["height"],p["turns"],p.get("tube_radius",.2),p.get("segments",48))
    raise ValueError(f"unsupported mesh recipe kind: {kind}")


def cone_mesh(radius_bottom, radius_top, height, segments=20):
    if (not all(math.isfinite(v) and v >= 0 for v in (radius_bottom,radius_top))
            or max(radius_bottom,radius_top) <= 0 or not math.isfinite(height) or height <= 0 or segments < 6):
        raise ValueError("cone dimensions are invalid")
    verts = []
    for z,r in ((-height/2,radius_bottom),(height/2,radius_top)):
        for i in range(segments):
            a=2*math.pi*i/segments
            verts.append((r*math.cos(a),r*math.sin(a),z))
    triangles=[]
    for i in range(segments):
        j=(i+1)%segments
        triangles.extend(((i,j,segments+j),(i,segments+j,segments+i)))
    for z,offset,r,reverse in ((-height/2,0,radius_bottom,True),(height/2,segments,radius_top,False)):
        center_id=len(verts); verts.append((0.,0.,z))
        for i in range(segments):
            j=(i+1)%segments
            tri=(center_id,j+offset,i+offset) if reverse else (center_id,i+offset,j+offset)
            triangles.append(tri)
    mesh=Mesh(tuple(verts),tuple(triangles)); validate_mesh(mesh); return mesh


def _translate_mesh(mesh, x, y, z):
    return Mesh(tuple((a + x, b + y, c + z) for a, b, c in mesh.vertices), mesh.triangles)


def _combine_meshes(meshes):
    vertices, triangles = [], []
    for mesh in meshes:
        offset = len(vertices)
        vertices.extend(mesh.vertices)
        triangles.extend(tuple(index + offset for index in face) for face in mesh.triangles)
    result = Mesh(tuple(vertices), tuple(triangles))
    validate_mesh(result)
    return result


def _rotate_translate_mesh(mesh, position, rotation):
    if (len(position) != 3 or len(rotation) != 3
            or not all(math.isfinite(value) for value in (*position, *rotation))):
        raise ValueError("integrated submesh transform must contain six finite values")
    rx, ry, rz = rotation
    sx, cx = math.sin(rx), math.cos(rx)
    sy, cy = math.sin(ry), math.cos(ry)
    sz, cz = math.sin(rz), math.cos(rz)
    vertices = []
    for x, y, z in mesh.vertices:
        # Canonical XYZ Euler order, matching component placement conventions.
        y1, z1 = y * cx - z * sx, y * sx + z * cx
        x2, z2 = x * cy + z1 * sy, -x * sy + z1 * cy
        x3, y3 = x2 * cz - y1 * sz, x2 * sz + y1 * cz
        vertices.append((x3 + position[0], y3 + position[1], z2 + position[2]))
    return Mesh(tuple(vertices), mesh.triangles)


def mesh_from_recipe(recipe):
    """Build the named base part plus any integrated, non-exported submeshes."""
    base = _mesh_from_base_recipe(recipe)
    integrated = recipe.get("integrated_submeshes", ())
    if not integrated:
        return base
    if not isinstance(integrated, list):
        raise ValueError("integrated_submeshes must be an ordered list")
    pieces = [base]
    seen_ids = set()
    for feature in integrated:
        feature_id = feature.get("submesh_id")
        if not isinstance(feature_id, str) or not feature_id or feature_id in seen_ids:
            raise ValueError("integrated submesh IDs must be unique nonempty names within their owner")
        seen_ids.add(feature_id)
        if feature.get("provenance") not in {"USER_SPECIFIED", "ASSUMED"} or feature.get("verification_status") != "NOT_VALIDATED":
            raise ValueError(f"integrated submesh must remain source-attributed and NOT_VALIDATED: {feature_id}")
        parameters = feature.get("parameters", {})
        kind = feature.get("kind")
        if kind == "box":
            feature_mesh = box_mesh(parameters.get("size_mm", ()))
        elif kind == "cylinder":
            diameter = parameters.get("diameter_mm")
            height = parameters.get("height_mm")
            if (not isinstance(diameter, (int, float)) or isinstance(diameter, bool)
                    or not isinstance(height, (int, float)) or isinstance(height, bool)):
                raise ValueError(f"integrated cylinder needs diameter and height: {feature_id}")
            feature_mesh = cylinder_mesh(diameter / 2, height)
        else:
            raise ValueError(f"unsupported integrated submesh recipe kind: {kind}")
        if kind == "cylinder":
            declared_size = parameters.get("size_mm")
            if declared_size != [diameter, height]:
                raise ValueError(f"integrated cylinder size must be [diameter, height]: {feature_id}")
        local_mesh = _rotate_translate_mesh(
            feature_mesh,
            feature.get("position_mm", ()),
            feature.get("rotation_rad", ()),
        )
        pieces.append(local_mesh)
    return _combine_meshes(pieces)


def _profile_prism_xz(profile, y_start, length):
    points = _profile(profile)
    if not math.isfinite(y_start) or not math.isfinite(length) or length <= 0:
        raise ValueError("blade profile extrusion must have a finite positive length")
    count = len(points)
    vertices = tuple((x, y, z) for y in (y_start, y_start + length) for x, z in points)
    cap = _triangulate(points)
    triangles = [tuple(reversed(face)) for face in cap]
    triangles.extend(tuple(index + count for index in face) for face in cap)
    for i in range(count):
        j = (i + 1) % count
        triangles.extend(((i, j, j + count), (i, j + count, i + count)))
    mesh = Mesh(vertices, tuple(triangles))
    signed_volume = sum(dot(mesh.vertices[a], cross(mesh.vertices[b], mesh.vertices[c])) / 6 for a, b, c in mesh.triangles)
    if signed_volume < 0:
        mesh = Mesh(mesh.vertices, tuple((a, c, b) for a, b, c in mesh.triangles))
    validate_mesh(mesh)
    return mesh


def _profile_prism_yz(profile, x_start, width):
    """Extrude a local-Y/local-Z blade section across its local-X width."""
    points = _profile(profile)
    if not math.isfinite(x_start) or not math.isfinite(width) or width <= 0:
        raise ValueError("blade profile extrusion must have a finite positive width")
    count=len(points)
    vertices=tuple((x,y,z) for x in (x_start,x_start+width) for y,z in points)
    cap=_triangulate(points)
    triangles=[tuple(reversed(face)) for face in cap]
    triangles.extend(tuple(index+count for index in face) for face in cap)
    for i in range(count):
        j=(i+1)%count
        triangles.extend(((i,j,j+count),(i,j+count,i+count)))
    mesh=Mesh(vertices,tuple(triangles))
    signed_volume=sum(dot(mesh.vertices[a],cross(mesh.vertices[b],mesh.vertices[c]))/6 for a,b,c in mesh.triangles)
    if signed_volume<0:
        mesh=Mesh(mesh.vertices,tuple((a,c,b) for a,b,c in mesh.triangles))
    validate_mesh(mesh)
    return mesh