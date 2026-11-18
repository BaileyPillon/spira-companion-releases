"""Test production PINE readers and AP write guards with synthetic RAM, without a ROM.

python tools/test-live-readers.py --jdk <JDK directory> --json <org.json jar>
"""
import argparse
import json
from pathlib import Path
import socketserver
import struct
import subprocess
import threading

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--jdk',required=True,type=Path)
parser.add_argument('--json',required=True,type=Path)
parser.add_argument('--android',required=True,type=Path)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
output=root/'build/live-reader-tests'
output.mkdir(parents=True,exist_ok=True)
subprocess.run([str(args.jdk/'bin/javac.exe'),'-cp',str(args.android),'-d',str(output),
    str(root/'app/src/Ps2Feed.java'),str(root/'tests/LiveReadersHarness.java')],check=True)

class Server(socketserver.TCPServer):
    allow_reuse_address=True

class Session(socketserver.StreamRequestHandler):
    def handle(self):
        while header:=self.rfile.read(4):
            size=struct.unpack('<I',header)[0]-4
            data=self.rfile.read(size)
            reply=bytearray();i=0
            self.server.requests+=1
            while i<len(data):
                code=data[i];i+=1
                if code<=7:
                    address=struct.unpack_from('<I',data,i)[0];i+=4
                    width=1<<(code%4)
                    assert 0<=address<=len(self.server.ram)-width
                    if code<4:
                        reply.extend(self.server.ram[address:address+width])
                    else:
                        value=data[i:i+width];i+=width
                        self.server.writes.append((address,bytes(value)))
                        self.server.ram[address:address+width]=value
                elif code in (12,13):
                    value=self.server.identity[code-12].encode()+b'\0'
                    reply.extend(struct.pack('<I',len(value))+value)
                elif code==15:reply.extend(struct.pack('<I',self.server.status))
                else:raise AssertionError(code)
            if self.server.mutate:self.server.mutate(self.server,data)
            self.wfile.write(struct.pack('<IB',len(reply)+5,0)+reply)

save=0x319150
field=0x500000
event=0xa00000
workers=0xb00000
event_data=event+0x1000
variables=event+0x2000

def put(ram,address,fmt,*values):struct.pack_into('<'+fmt,ram,address,*values)

def script(name,room):
    ram=bytearray(32*1024*1024)
    put(ram,save,'H',room)
    put(ram,0x58df58,'I',field)
    put(ram,field,'I',1)
    put(ram,field+0xa,'HH',2,80)
    put(ram,field+0x1c,'I',workers)
    put(ram,field+0x48,'I',event)
    put(ram,event+0xc,'I',0x80)
    ram[event+0x80:event+0x88]=name.encode()
    put(ram,event+0x20,'I',0x1000)
    put(ram,event+0x38,'I',0x100)
    put(ram,event+0x102,'H',400)
    put(ram,event+0x114,'I',0x2000)
    return ram

def decl(ram,id,descriptor,count=1):put(ram,variables+id*8,'II',descriptor,count)

def run(ram,method,room,identity=('SLPS-25088','658597E2'),status=0,mutate=None):
    with Server(('127.0.0.1',28011),Session) as server:
        server.ram=ram;server.identity=identity;server.status=status;server.writes=[];server.requests=0;server.mutate=mutate
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            result=subprocess.check_output([str(args.jdk/'bin/java.exe'),'-cp',str(output)+';'+str(args.json),
                'com.spiracompanion.thor.LiveReadersHarness',method,str(room)],text=True,timeout=10)
            return json.loads(result),server.writes,server.requests
        finally:server.shutdown();thread.join()

def blitz():
    ram=script('bltz0000',62)
    for id,offset,count,kind in [(42,0xc0,16,0x5d000000),(52,0x144,1,0x5c000000),(53,0x148,1,0x5c000000),
        (166,0xf76,1,0x0c000000),(173,0xf90,16,0x0d000000),(175,0xfb0,1,0x0c000000)]:decl(ram,id,kind|offset,count)
    for id,offset in zip([57,59,61,63,65,67,69],[0x20c,0x28c,0x30c,0x38c,0x40c,0x48c,0x50c]):
        decl(ram,id,0x5d000000|offset,16)
        for slot in range(16):put(ram,event_data+offset+slot*4,'i',20)
    put(ram,event_data+0x144,'ii',185,300)
    put(ram,event_data+0xfb0,'B',2)
    put(ram,save+0x163e,'BBB',2,1,1)
    for slot in [0,1,2,3,4,5,8,9,10,11,12,13]:
        put(ram,event_data+0xc0+slot*4,'i',100+slot)
        put(ram,event_data+0xf90+slot,'B',slot)
        put(ram,workers+(slot+2)*0xb58+0x558,'fff',slot*30.0,0,slot*-15.0)
        put(ram,workers+(slot+2)*0xb58+0x9c,'I',0xc00000+slot*0x1000)
    put(ram,workers+18*0xb58+0x9c,'I',0xc10000)
    put(ram,0xc10000+0x1a8,'II',0xc00000,14)
    return ram

passed=0
def check(condition,label):
    global passed
    assert condition,label
    passed+=1
    print('PASS',label)

ram=blitz();value,_,requests=run(ram,'readBlitzMatch',62)
check(value['elapsed']==185 and value['players'][6]['slot']==8 and value['players'][6]['hp']==108,'Blitz clock, active slots and current stats')
check(requests<=12,'Blitz reads are batched')
ram=blitz();put(ram,0xc10000+0x1a8,'I',0)
check(run(ram,'readBlitzMatch',62)[0]['carrier']==-1,'Ball in flight does not retain old possession')
ram=blitz();decl(ram,42,0x5d0000c1,16)
check(run(ram,'readBlitzMatch',62)[0] is None,'Reject mismatching variable layout')
ram=blitz();ram[event+0x80:event+0x88]=b'hiku1500'
check(run(ram,'readBlitzMatch',62)[0] is None,'Reject wrong active script')
ram=blitz();put(ram,event_data+0xf90+8,'B',0)
check(run(ram,'readBlitzMatch',62)[0] is None,'Reject duplicate match player IDs')
ram=blitz();put(ram,event_data+0x144,'i',999)
check(run(ram,'readBlitzMatch',62)[0] is None,'Reject stale or invalid match timer')
ram=blitz()
def transition(server,commands):
    if server.requests==7:put(server.ram,field+0x1c,'I',workers+0x1000)
check(run(ram,'readBlitzMatch',62,mutate=transition)[0] is None,'Reject worker pointer changing during a match read')
for room,name,var in [(241,'mcfr0100',26),(242,'mcfr0200',20)]:
    ram=script(name,room);decl(ram,var,0x0c000041);decl(ram,var+1,0x0c000042)
    put(ram,event_data+0x41,'BB',1,6)
    check(run(ram,'readButterfly',room)[0]=={'active':True,'caught':6},name+' caught count')
    put(ram,event_data+0x41,'BB',0,7)
    check(run(ram,'readButterfly',room)[0]=={'active':False},name+' ignores stale exit count')
ram=script('mcfr0200',242);decl(ram,20,0x0c000041);decl(ram,21,0x0c000042);put(ram,event_data+0x41,'BB',1,2)
for i,worker in enumerate([8,10,11,12,13,14,15,16]):
    handle=0xc00000+i*0x1000;put(ram,workers+worker*0xb58+0x9c,'I',handle)
    put(ram,workers+worker*0xb58+0x558,'fff',10.0+i,0,20.0+i)
    if i<3:
        r,g,b=(.1,.3,1) if i!=1 else (.9,.1,.1)
        for offset,value in [(0x32c,r),(0x338,g),(0x344,b),(0x350,1.0 if i<2 else 0.0)]:put(ram,handle+offset,'f',value)
markers=run(ram,'readButterfly',242)[0]['actors']
check([m['kind'] for m in markers]==['blue','red'] and markers[0]['x']==10,'Butterfly tint roles and fading collected actors')
ram=script('nagi0000',223)
for id,offset in [(104,0xb0),(105,0xb1),(106,0xb2),(113,0xb9),(114,0xba),(115,0xbb),(116,0xbc),(117,0xbd),(135,0xd3),(137,0xd5),(140,0xd8),(149,0xe1)]:decl(ram,id,0x0c000000|offset)
for offset,value in [(0xb0,5),(0xb1,38),(0xbc,4),(0xbd,2),(0xd3,15),(0xd5,1),(0xe1,1)]:put(ram,event_data+offset,'B',value)
check(run(ram,'readCatcher',223)[0]=={'finished':False,'tenths':385,'balloons':15,'birds':1},'Catcher live clock and counters')
put(ram,event_data+0xbc,'B',3)
check(run(ram,'readCatcher',223)[0] is None,'Other Chocobo training modes do not look like Catcher')
ram=script('bsyt0100',122)
for id in range(37,53):decl(ram,id,0x5c000000|(0xac+4*(id-37)))
put(ram,event_data+0xac,'i',2);put(ram,event_data+0xd8,'i',1)
value,_,_=run(ram,'readCloister',122)
check(value['held']==2 and len(value['sockets'])==9 and value['phases'][0]==1,'Besaid held sphere, recesses and phase flags')
ram=script('klyt1000',108)
for id in range(24,36):decl(ram,id,0x0c000058+id-24)
put(ram,event_data+0x5b,'B',6);put(ram,event_data+0x63,'B',3)
put(ram,workers+6*0xb58+0x558,'fff',50.011,20.01,205.15)
value=run(ram,'readCloister',108)[0]
check(value['held']==6 and value['puzzle']=={'doors':3,'dropped':True} and value['sockets'][-1]['id']==34,
    'Kilika has the purple sphere, both doors and a settled pedestal')
ram=script('djyt0600',214)
for id in range(40,53):decl(ram,id,0x0c000094+id-40)
for id,offset in [(75,0xd9),(76,0xda),(77,0xdb),*zip(range(80,88),range(0xde,0xe6))]:decl(ram,id,0x0c000000|offset)
put(ram,event_data+0xd9,'BBB',1,1,1)
put(ram,event_data+0xde,'BBBBBBBB',1,0,1,0,1,1,1,2)
value=run(ram,'readCloister',214)[0]
check(value['puzzle']=={'pit':True,'farPedestal':True,'elevator':True,'upper':21,'stage':1,'door':True,'glyph':2}
    and value['sockets'][-1]['id']==52,'Djose separates upper-floor progress and interaction state from the sockets')
ram=script('mcyt0500',239)
for id in range(31,40):decl(ram,id,0x0c000094+id-31)
for id,offset in [(46,0xa3),(54,0xc6),(56,0xc8),(58,0xca)]:decl(ram,id,0x0c000000|offset)
for offset,value in [(0x94,11),(0xa3,3),(0xc6,1),(0xc8,1),(0xca,1)]:put(ram,event_data+offset,'B',value)
value=run(ram,'readCloister',239)[0]
check(value['held']==11 and value['puzzle']=={'pedestal':3,'iceStop':True,'lifted':True,'bridgeSeen':True}
    and value['sockets'][-1]['id']==39,'Macalania keeps the exchange reserve out of the visible sockets')
ram=script('bvyt1100',306)
for id,offset in [(25,0x1e),(26,0x1f),(27,0x20),(32,0x25),(33,0x26),(36,0x2a)]:decl(ram,id,0x0c000000|offset)
decl(ram,43,0x0d000032,0x000c0048)
put(ram,event_data+0x25,'BB',1,1)
put(ram,event_data+0x2a,'B',1)
for group,slot in enumerate([2,5,8,11,7],1):put(ram,event_data+0x32+group*12+slot,'B',1)
value=run(ram,'readCloister',306)[0]
check(value['puzzle']=={'firstBridge':True,'exitBridge':True,'knightLance':True} and {r['id']:r['value'] for r in value['sockets']}[7]==3,'Bevelle identifies the Destruction Sphere and the separate Knight Lance chest')
put(ram,event_data+0x32+60+9,'B',1)
check(run(ram,'readCloister',306)[0] is None,'Bevelle rejects a sphere in more than one place during a transition')
put(ram,event_data+0x25,'BB',0,0)
ram[event_data+0x32:event_data+0x7a]=bytes(0x48)
put(ram,event_data+0x1f,'B',1)
for group,slot in enumerate([2,1,6,7,9],1):put(ram,event_data+0x32+group*12+slot,'B',1)
value=run(ram,'readCloister',306)[0]
check(value['held']==1 and {r['id']:r['value'] for r in value['sockets']}[4]==0,
    'Bevelle follows the starting-branch sphere into Tidus’s hand on the International disc')
ram=script('dome0700',320)
for id in range(8,15):decl(ram,id,0x5c000004+4*(id-8))
for id,offset in [(15,0x20),(17,0x22),(18,0x23),(19,0x24),(24,0x29)]:decl(ram,id,0x0c000000|offset)
put(ram,event_data+0x04,'I',5);put(ram,event_data+0x14,'I',3);put(ram,event_data+0x20,'B',6);put(ram,event_data+0x29,'B',8)
value=run(ram,'readCloister',320)[0]
check(value['puzzle']=={'phase':5,'solved':6,'small':0,'large':0,'white':8}
    and any(row['id']==12 and row['value']==3 for row in value['sockets']),'Zanarkand exposes the sphere only when the white tiles complete')
put(ram,event_data+4,'I',0)
check(all(row['id']!=12 for row in run(ram,'readCloister',320)[0]['sockets']),'Zanarkand story-phase state cannot expose the white-tile sphere')
for room,name,workers_to_use,pedestal in [(306,'bvyt1100',[8,9,10,11,12],13),(320,'dome0700',[29,30,31],None)]:
    ram=script(name,room);put(ram,workers+0x9c,'I',0xc00000)
    if pedestal:put(ram,workers+pedestal*0xb58+0x9c,'I',0xc01000)
    for i,worker in enumerate(workers_to_use):
        handle=0xc02000+i*0x1000;put(ram,workers+worker*0xb58+0x9c,'I',handle)
        if i==len(workers_to_use)-1:put(ram,handle+0x1a8,'II',0xc00000,5)
    check(run(ram,'readCloister',room)[0]['heldType']=='Destruction',name+' identifies held sphere through the live attachment')
    if room==306:
        put(ram,0xc02000+0x1a8,'II',0xc00000,5)
        check(run(ram,'readCloister',room)[0] is None,'Bevelle rejects two spheres reported in Tidus’s hand')

def ap_ram():
    ram=bytearray(32*1024*1024);put(ram,save,'H',277);put(ram,save+0x3d14,'I',100)
    ram[save+0x3d58:save+0x3d58+20]=bytes([0,2,4]+[255]*17)
    put(ram,0x662070,'I',0x900000);put(ram,0x316f80,'B',1)
    for id in range(8):
        put(ram,0x900000+id*0xc50+0xc,'H',id)
        put(ram,0x900000+id*0xc50+0x15,'B',1 if id in [0,2,4] else 0)
    return ram
value,writes,_=run(ap_ram(),'ap','enabled')
check([address for address,_ in writes]==[0x31f894,0x31f896,0x31f898] and all(value==b'\1' for _,value in writes),'AP sharing only marks recruited party')
for label,identity,status,enabled,battle in [('disabled',('SLPS-25088','658597E2'),0,'disabled',1),
    ('wrong CRC',('SLPS-25088','00000000'),0,'enabled',1),('paused',('SLPS-25088','658597E2'),1,'enabled',1),
    ('field transition',('SLPS-25088','658597E2'),0,'enabled',0)]:
    ram=ap_ram();put(ram,0x316f80,'B',battle)
    check(not run(ram,'ap',enabled,identity,status)[1],'AP writes refused: '+label)
def pause_before_write(server,commands):
    if server.requests==7:server.status=1
check(not run(ap_ram(),'ap','enabled',mutate=pause_before_write)[1],'AP write guard rechecks pause immediately before writing')

def continuity_ram():
    ram=bytearray(32*1024*1024)
    put(ram,save,'H',277)
    put(ram,save+0xbec,'H',1250)
    put(ram,save+0x3d48,'I',100)
    put(ram,save+0x3ecc,'H',8192)
    put(ram,save+0x3ecc+512,'B',2)
    return ram

check(run(continuity_ram(),'snapshot',0)[0]['status']=='live','stable PS2 context publishes live')
def change_snapshot_context(server,commands):
    if commands==bytes([15,12,13]):
        put(server.ram,save,'H',278)
check(run(continuity_ram(),'snapshot',0,mutate=change_snapshot_context)[0]['status']=='waiting',
    'PS2 snapshot discards a room transition under the same disc identity')
def pause_snapshot(server,commands):
    if commands==bytes([15,12,13]):server.status=1
check(run(continuity_ram(),'snapshot',0,mutate=pause_snapshot)[0]['status']=='waiting',
    'PS2 snapshot discards a pause that occurs during sampling')

check(run(continuity_ram(),'cheat','gil')[1]==[(save+0x3d48,struct.pack('<I',200))],
    'gil edit writes once after a stable final guard')
check(run(continuity_ram(),'cheat','item')[1]==[(save+0x3ecc+512,b'\x04')],
    'item edit checks the owned item slot and writes once')
def change_before_cheat_guard(change):
    def mutate(server,commands):
        if commands==struct.pack('<BI',2,0x662070):change(server)
    return mutate
for label,scenario,change in [
        ('same disc moved or reloaded','gil',lambda server:put(server.ram,save,'H',278)),
        ('the final item slot now contains another item','item',lambda server:put(server.ram,save+0x3ecc,'H',8193)),
        ('the final amount changed','gil',lambda server:put(server.ram,save+0x3d48,'I',150)),
        ('battle has just started','gil',lambda server:put(server.ram,0x316f80,'B',1)),
        ('emulator paused','gil',lambda server:setattr(server,'status',1))]:
    check(not run(continuity_ram(),'cheat',scenario,mutate=change_before_cheat_guard(change))[1],
        'cheat writes refused: '+label)
check(not run(continuity_ram(),'cheat','cancel')[1],'cheat writes refused after session cancellation')
check(run(continuity_ram(),'cheat','disabled')[2]==0,'disabled cheat does not connect to PINE')
print(f'{passed} native reader and write-guard checks passed. Synthetic RAM is not a gameplay acceptance test.')
