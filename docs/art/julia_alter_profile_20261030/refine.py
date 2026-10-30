from pathlib import Path
import json
R=Path(__file__).parent
s=json.loads((R/'draft-sprites.json').read_text());a=s['cells'];ed=[]
P={'void':'20292c','dark':'343e40','mid':'737f7d','steel':'aeb7af','light':'d2d5c9','brown':'4d3528','hair':'32231c','warm':'75513a','skin':'fac9a6','shade':'d49b78','lip':'bf8b74','red':'9d3433','iris':'772f2d','ivory':'e7d6bf','navy':'303640','gold':'a58b54'}
def put(x,y,c,why):
    h=P.get(c,c).lstrip('#');v=[int(h[n:n+2],16) for n in (0,2,4)]+[255]
    if a[y][x]!=v:ed.append({'x':x,'y':y,'before':a[y][x],'after':v,'reason':why});a[y][x]=v
# Preserve the natural offset of the two eyes; one small red lens and one human eye.
for x,y,c in [(6,7,'mid'),(6,8,'steel'),(5,8,'dark'),(5,9,'dark'),(6,9,'red'),(6,10,'mid'),(6,11,'dark'),(7,10,'skin'),(7,11,'shade'),(9,7,'brown'),(10,7,'warm'),(9,8,'hair'),(10,8,'iris'),(9,9,'skin'),(10,9,'skin'),(8,10,'skin'),(7,10,'shade'),(8,11,'lip'),(9,11,'lip'),(10,11,'warm'),(8,12,'skin'),(9,12,'skin'),(10,12,'shade'),(8,13,'skin'),(9,13,'shade')]:put(x,y,c,'Distinct eyes, opposite facial implant and restrained mouth')
for x,y,c in [(8,3,'warm'),(7,4,'warm'),(6,5,'brown'),(5,6,'hair'),(11,4,'brown'),(12,5,'warm'),(13,6,'brown'),(14,7,'hair'),(15,10,'warm'),(14,11,'hair'),(15,12,'warm'),(16,12,'brown'),(15,13,'hair'),(16,14,'warm'),(15,15,'brown'),(16,16,'warm')]:put(x,y,c,'Hair sweep and braid alternating light and shade')
# Segmented half-neck, on the opposite side from the facial metal.
for x,y,c in [(12,12,'dark'),(12,13,'steel'),(12,14,'dark'),(13,14,'mid'),(12,15,'steel'),(13,15,'dark'),(12,16,'mid'),(13,16,'void'),(11,15,'mid'),(11,16,'dark')]:put(x,y,c,'Segmented neck and its depth')
# Redraw the metal torso on the fixed grid: curved clavicle, round shoulder and pistons.
rows={
17:['mid','steel','light','steel','mid','dark','mid','steel','light','mid','mid'],
18:['dark','void','mid','dark','void','dark','steel','mid','dark','void','mid'],
19:['mid','dark','steel','light','steel','mid','mid','dark','void','dark','steel'],
20:['mid','void','dark','steel','dark','void','steel','void','dark','steel','ivory'],
21:['dark','void','steel','mid','void','steel','dark','steel','steel','ivory','ivory']}
for y,colors in rows.items():
    for x,c in enumerate(colors,11):put(x,y,c,'Curved chest brace, shoulder bearing and diagonal piston')
for x,y,c in [(4,17,'navy'),(5,17,'gold'),(6,17,'navy'),(7,18,'ivory'),(7,19,'ivory'),(8,20,'ivory'),(9,21,'ivory'),(10,19,'shade'),(10,20,'ivory'),(10,21,'ivory')]:put(x,y,c,'Clothed half retains dark vest and narrow ivory boundary')
put(10,11,'shade','Soften lip corner');put(10,10,'bf9279','Slightly raised corner, not a broad grin')
ed.append({'x':21,'y':17,'before':a[17][21],'after':[0,0,0,0],'reason':'Round shoulder silhouette at outer edge'});a[17][21]=[0,0,0,0]
s['edits']=ed;s['review']={'faceBoxCells':[6,7,11,13],'chinRow':13,'eyes':{'cells':[[6,9],[10,8]],'kind':['mechanical lens','human crimson eye']},'angle':'viewer-left shallow three-quarter; opposite base','bodyCrop':'shoulders and upper chest only, no hands','mechanicalFace':'character right / viewer left','mechanicalTorso':'character left / viewer right'}
(R/'sprites.json').write_text(json.dumps(s,indent=2)+'\n');print('Manual cell edits:',len(ed))
