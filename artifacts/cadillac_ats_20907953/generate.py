"""Approximate fitting shell, millimetres. Python 3 standard library only.
Edit PARAMETERS then run python3 generate.py. No OEM mounting geometry implied.
"""
import math, struct, json, collections, pathlib, zlib
OUT = pathlib.Path(__file__).resolve().parent
PARAMETERS = dict(length=620.8, width=95.5, thickness=2.5,
                  longitudinal_bow=35.0, cross_section_depth=14.0,
                  end_width_ratio=0.48, nx=240, ny=24)
P = PARAMETERS

def surface(x, v, inside=False):
    u = 2*x/P['length']
    # Rounded, tapered ends; provisional bow, not recovered from photographs.
    w = P['width']*(1-(1-P['end_width_ratio'])*abs(u)**6)
    y = v*w/2
    # Two blended facets, with a ridge toward one edge.
    ridge = -0.30
    h = (v+1)/(ridge+1) if v < ridge else (1-v)/(1-ridge)
    z = P['longitudinal_bow']*u*u + P['cross_section_depth']*h
    return (x,y,z-(P['thickness'] if inside else 0))

def mesh(lo, hi, nx):
    ny=P['ny']; points=[]; faces=[]
    for inside in (False,True):
        for i in range(nx+1):
            for j in range(ny+1):
                points.append(surface(lo+(hi-lo)*i/nx,-1+2*j/ny,inside))
    n=(nx+1)*(ny+1)
    def quad(a,b,c,d): faces.extend([(a,b,c),(a,c,d)])
    for i in range(nx):
        for j in range(ny):
            a=i*(ny+1)+j; b=a+ny+1
            quad(a,b,b+1,a+1); quad(n+a+1,n+b+1,n+b,n+a)
    for i in range(nx):
        a=i*(ny+1); b=a+ny+1
        quad(a,n+a,n+b,b)
        a+=ny; b+=ny; quad(a,b,n+b,n+a)
    for j in range(ny):
        quad(j,j+1,n+j+1,n+j)
        a=nx*(ny+1)+j; quad(a,n+a,n+a+1,a+1)
    return points,faces

def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def write_stl(name,points,faces):
    edges=collections.Counter(); directions=collections.Counter(); vol=0
    for f in faces:
        a,b,c=[points[i] for i in f]
        vol+=sum(x*y for x,y in zip(a,cross(b,c)))/6
        for i,j in zip(f,f[1:]+f[:1]):
            edges[tuple(sorted((i,j)))]+=1; directions[(i,j)]+=1
    assert all(v==2 for v in edges.values())
    assert all(directions[(a,b)]==directions[(b,a)] for a,b in edges)
    assert vol>0
    mins=[min(p[i] for p in points) for i in range(3)]
    maxs=[max(p[i] for p in points) for i in range(3)]
    with (OUT/name).open('wb') as fp:
        fp.write(b'APPROXIMATE FITTING SHELL - NOT OEM VERIFIED'.ljust(80,b' '))
        fp.write(struct.pack('<I',len(faces)))
        for f in faces:
            a,b,c=[points[i] for i in f]; normal=cross(sub(b,a),sub(c,a))
            norm=math.sqrt(sum(t*t for t in normal)); assert norm>1e-9
            normal=tuple(t/norm for t in normal)
            fp.write(struct.pack('<12fH',*normal,*a,*b,*c,0))
    return dict(file=name,triangles=len(faces),watertight=True,consistent_winding=True,
                bounds_mm=[mins,maxs],dimensions_mm=[b-a for a,b in zip(mins,maxs)],volume_mm3=vol)

def preview(points,faces):
    W,H=1400,650; pix=bytearray([246,247,249])*(W*H); depth=[-1e9]*(W*H)
    def project(p):
        x,y,z=p
        return (W/2+1.85*(x+.40*y),H/2+1.85*(.70*y-.90*z+.12*x),z+.75*y)
    projected=[project(p) for p in points]
    for f in faces:
        a,b,c=[projected[i] for i in f]
        normal=cross(sub(points[f[1]],points[f[0]]),sub(points[f[2]],points[f[0]]))
        norm=math.sqrt(sum(t*t for t in normal))
        light=abs(sum(x*y for x,y in zip(normal,(.1,-.4,.91)))/norm)
        shade=int(105+120*light); color=(shade,min(255,shade+3),min(255,shade+7))
        den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(den)<1e-9: continue
        for yy in range(max(0,int(min(a[1],b[1],c[1]))),min(H,int(max(a[1],b[1],c[1]))+2)):
            for xx in range(max(0,int(min(a[0],b[0],c[0]))),min(W,int(max(a[0],b[0],c[0]))+2)):
                u=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
                v=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den
                w=1-u-v
                if min(u,v,w)<0: continue
                d=u*a[2]+v*b[2]+w*c[2]; idx=yy*W+xx
                if d>depth[idx]: depth[idx]=d; pix[idx*3:idx*3+3]=bytes(color)
    def chunk(t,data): return struct.pack('>I',len(data))+t+data+struct.pack('>I',zlib.crc32(t+data)&0xffffffff)
    raw=b''.join(b'\0'+pix[y*W*3:(y+1)*W*3] for y in range(H))
    (OUT/'preview.png').write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>2I5B',W,H,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b''))

if __name__=='__main__':
    length=P['length']; pts,fs=mesh(-length/2,length/2,P['nx'])
    reports=[write_stl('ats_20907953_APPROX_full.stl',pts,fs)]
    for k in range(4):
        pp,ff=mesh(-length/2+k*length/4,-length/2+(k+1)*length/4,P['nx']//4)
        # Each separate fitting coupon is centered in X and placed at Z=0.
        cx=(min(p[0] for p in pp)+max(p[0] for p in pp))/2; zmin=min(p[2] for p in pp)
        pp=[(x-cx,y,z-zmin) for x,y,z in pp]
        reports.append(write_stl(f'fit_section_{k+1}_of_4.stl',pp,ff))
    scad='// Approximate shell in mm. Regenerate with generate.py to change dimensions.\n'
    scad+='// No measured OEM clips, no lettering.\n'
    scad+='points='+json.dumps(pts)+';\nfaces='+json.dumps(fs)+';\npolyhedron(points=points, faces=[for(f=faces) [f[2],f[1],f[0]]], convexity=10);\n'
    (OUT/'ats_20907953_APPROX.scad').write_text(scad)
    (OUT/'validation.json').write_text(json.dumps(dict(parameters=P,meshes=reports),indent=2))
    preview(pts,fs)
    print(json.dumps(reports,indent=2))
