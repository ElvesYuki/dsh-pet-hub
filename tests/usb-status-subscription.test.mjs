import assert from 'node:assert/strict';
import test from 'node:test';
import {createDesktopStatusSources} from '../packages/runtime/device-status-sources.mjs';
import {desktopUsbOpener, desktopUsbStatus} from '../packages/runtime/desktop-usb-ownership.mjs';
import {decodeUsbStatusReport, subscribeUsbDeviceStatus} from '../packages/runtime/usb-status-subscription.mjs';
import {minimalStatusV2} from './fixtures/device-status-fixture.mjs';

const identity = '1/001122334455';
const binary = minimalStatusV2('0.1.33', 0);
const report = {version: '0.1.33', slot: 'ota_0', battery: null, sensors: null, selected: false, busy: false};

test('USB subscriptions match ID, accept increasing gaps, renew the same ID and unsubscribe before close', async () => {
  let incoming = Buffer.alloc(0), id, time = 0, published = 0;
  const commands = [], controller = new AbortController();
  const reply = (id, seq) => '@VP8_STATUS3_PUSH id=' + id + ' seq=' + seq + ' data=' + binary.toString('base64') + '\n';
  const feed = message => { incoming = Buffer.concat([incoming, Buffer.from(message)]); };
  const io = {
    read(buffer) {
      if (incoming.length === 0) throw Object.assign(Error(), {code:'EAGAIN'});
      const part = incoming.subarray(0, 64);
      part.copy(buffer);
      incoming = incoming.subarray(part.length);
      return {bytesRead: part.length};
    },
    write(bytes) {
      const value = bytes.toString();
      commands.push(value);
      const sub = /^STATUS3_SUB ([a-f0-9]{8})\n$/.exec(value);
      if (sub && !id) {
        id = sub[1];
        feed(reply('4a01c0de' === id ? '4a01c0df' : '4a01c0de', 100) + reply(id,1) + reply(id,1) + reply(id,3));
      } else if (sub) {
        assert.equal(sub[1],id);
        feed(reply(id,8));
      }
      return {bytesWritten: bytes.length};
    },
    close() { commands.push('closed'); },
  };
  await assert.rejects(subscribeUsbDeviceStatus({options: {port: 'fake', identity, identifyUsb: () => identity, openTty: () => io},
    signal: controller.signal, now: () => time,
    pause() {
      if (time < 9000 && published < 2) return;
      time += 3000;
      if (time < 9000) feed(reply(id, 3 + time/3000));
    },
    publish(value) { assert.deepEqual(value, report); if (++published === 5) controller.abort(); },
  }), {name:'AbortError'});
  assert.equal(published,5);
  assert.deepEqual(commands,['STATUS3_SUB '+id+'\n','STATUS3_SUB '+id+'\n','STATUS3_UNSUB '+id+'\n','closed']);
  assert.equal(decodeUsbStatusReport(reply(id,0).trim().slice(18),id,0),undefined);
});

test('foreground maintenance waits for the subscription to release its USB handle', async () => {
  const scope = {};
  const release = Promise.withResolvers(), yielding = Promise.withResolvers();
  const background = await desktopUsbOpener(() => ({close: () => release.promise}), scope, {
    async yieldToForeground() { yielding.resolve(); await background.close(); },
  })({});
  assert.equal(desktopUsbStatus(scope).usbBusy,false);
  let opened = false;
  const foreground = desktopUsbOpener(() => {
    opened = true;
    return {close() {}};
  },scope)({});
  await yielding.promise;
  assert.equal(opened,false);
  assert.equal(desktopUsbStatus(scope).usbBusy,true);
  await assert.rejects(desktopUsbOpener(assert.fail,scope)({}),{code:'device_desktop_usb_busy'});
  release.resolve();
  const io = await foreground;
  assert.equal(opened,true);
  await io.close();
  assert.equal(desktopUsbStatus(scope).usbBusy,false);
});

function clockFixture() {
  let now=0, index=0;
  const tasks=new Map();
  return {
    now:()=>now,
    schedule(fn, delay) {
      tasks.set(++index,{fn, at: now+delay});
      return index;
    },
    unschedule:id=>tasks.delete(id),
    to(target) {
      for (;;) {
        const entry=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0];
        if (!entry || entry[1].at>target) break;
        const [id, job]=entry;
        tasks.delete(id);
        now=job.at;
        job.fn();
      }
      now=target;
    },
  };
}

test('USB follows attachment and current TCP freshness without renderer or duplicate periodic reads', async () => {
  const life=new AbortController(), clock=clockFixture();
  let usb, busy=false;
  const runs=[];
  const hub=createDesktopStatusSources({usbIdentity:identity, lifetime:life.signal, clock,
    usbStatus:()=>({usbBusy:busy,sameUsbTarget:true}),usbAttachment:()=>usb,
    read:assert.fail, subscribe({signal,publish}) {
      runs.push({signal,publish});
      return new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));
    }});
  async function tick(at) {
    clock.to(at);
    for (let n=0;n<6;n++) await Promise.resolve();
  }
  const tcp=hub.attach({usbIdentity:identity,push:true,close() {}});
  assert.equal(tcp.receive(1,{schema:1,...report}),true);
  usb='attached-1';
  await tick(250);
  assert.equal(runs.length,1);
  runs[0].publish(report);
  assert.equal(runs[0].signal.aborted,true);
  await tick(3000);
  assert.equal(runs.length,1);
  await tick(6000);
  assert.equal(runs.length,2);
  assert.equal(hub.snapshot().usbPresent,true);
  runs[1].publish(report);
  assert.equal((await hub.battery.sample('read',life.signal)).status,'not_reported');
  busy=true;
  await tick(6250);
  assert.equal(runs[1].signal.aborted,true);
  busy=false;
  await tick(6500);
  assert.equal(runs.length,3);
  assert.equal(tcp.receive(2,{schema:1,...report}),true);
  assert.equal(runs[2].signal.aborted,true);
  await tick(6750);
  assert.equal(runs.length,3);
  usb='attached-2';
  await tick(7000);
  assert.equal(runs.length,4);
  runs[3].publish(report);
  assert.equal(runs[3].signal.aborted,true);
  life.abort();
  await hub.battery.drain();
  hub.close();
});
