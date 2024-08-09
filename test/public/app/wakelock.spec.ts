'use sanity'

import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'
import * as sinon from 'sinon'

import { PubSub } from '../../../public/scripts/app/pubsub'
import { WakeLock, WakeLockSentinel } from '../../../public/scripts/app/wakelock'
import assert from 'assert'

@suite
export class WakeLockInitTests extends PubSub {
  takeLockSpy: sinon.SinonStub = sinon.stub()
  releaseLockSpy: sinon.SinonStub = sinon.stub()
  before () {
    PubSub.subscribers = {}
    PubSub.intervals = {}
    this.takeLockSpy = sinon.stub(WakeLock, 'TakeLock')
    this.releaseLockSpy = sinon.stub(WakeLock, 'ReleaseLock')
  }

  after () {
    this.takeLockSpy.restore()
    this.releaseLockSpy.restore()
  }

  @test
  'it should subscribe to Picture:LoadNew' () {
    WakeLock.Init()
    expect(PubSub.subscribers).to.have.any.keys('PICTURE:LOADNEW')
  }

  @test
  'it should execute TakeLock on receiving Picture:LoadNew notification' () {
    WakeLock.Init()
    const fn = (PubSub.subscribers['PICTURE:LOADNEW'] || [])[0]
    assert(fn)
    fn(undefined)
    expect(this.takeLockSpy.callCount).to.equal(1)
  }

  @test
  'it should add interval for WakeLock:Release' () {
    WakeLock.Init()
    expect(PubSub.intervals).to.have.any.keys('WakeLock:Release')
  }

  @test
  'it should use an interval of 30 seconds for wakelock.Release()' () {
    WakeLock.Init()
    const interval = PubSub.intervals['WakeLock:Release']
    assert(interval)
    expect(interval.intervalCycles).to.equal(3000)
  }

  @test
  'it should invoke WakeLock.release() when release timer expires' () {
    WakeLock.Init()
    const interval = PubSub.intervals['WakeLock:Release']
    assert(interval)
    assert(interval.method)
    interval.method()
    expect(this.releaseLockSpy.callCount).to.equal(1)
  }
}

@suite
export class WakeLockTakeLockTests extends PubSub {
  clock: sinon.SinonFakeTimers | undefined
  wakelockRequest: sinon.SinonStub = sinon.stub()
  sentinel: WakeLockSentinel = {
    release: sinon.stub().resolves(),
    released: false
  }

  before () {
    this.clock = sinon.useFakeTimers()
    WakeLock.sentinel = null
    WakeLock.timeout = 0
    this.sentinel = {
      release: sinon.stub().resolves(),
      released: false
    }
    this.wakelockRequest = sinon.stub()
    this.wakelockRequest.resolves(this.sentinel)
    assert(undefined === navigator.wakeLock, 'expect env not to support wakelock for testing')
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      get: () => {
        return {
          request: this.wakelockRequest
        }
      }
    })
  }

  after () {
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      get: () => undefined
    })
    this.clock?.restore()
  }

  @test
  async 'it should take lock if sentinel is null' () {
    await WakeLock.TakeLock()
    expect(this.wakelockRequest.callCount).to.equal(1)
  }

  @test
  async 'it should take lock if sentinel is already released' () {
    WakeLock.sentinel = {
      release: () => Promise.resolve(),
      released: true
    }
    await WakeLock.TakeLock()
    expect(this.wakelockRequest.callCount).to.equal(1)
  }

  @test
  async 'it should not take lock if lock already held' () {
    WakeLock.sentinel = {
      release: () => Promise.resolve(),
      released: false
    }
    await WakeLock.TakeLock()
    expect(this.wakelockRequest.callCount).to.equal(0)
  }

  @test
  async 'it should save lock sentinel when sentinel is null' () {
    await WakeLock.TakeLock()
    expect(WakeLock.sentinel).to.equal(this.sentinel)
  }

  @test
  async 'it should save lock sentinel when current sentinel is already released' () {
    WakeLock.sentinel = {
      release: () => Promise.resolve(),
      released: true
    }
    await WakeLock.TakeLock()
    expect(WakeLock.sentinel).to.equal(this.sentinel)
  }

  @test
  async 'it should not overwrite lock sentinel when lock already held' () {
    WakeLock.sentinel = {
      release: () => Promise.resolve(),
      released: false
    }
    await WakeLock.TakeLock()
    expect(WakeLock.sentinel).to.not.equal(this.sentinel)
  }

  @test
  async 'it should set timeout when taking lock' () {
    this.clock?.tick(3141)
    await WakeLock.TakeLock()
    expect(WakeLock.timeout).to.equal(123141) // 120 seconds plus system time
  }

  @test
  async 'it should reset timeout when lock already held' () {
    this.clock?.tick(6282)
    WakeLock.sentinel = this.sentinel
    await WakeLock.TakeLock()
    expect(this.wakelockRequest.callCount).to.equal(0)
    expect(WakeLock.timeout).to.equal(126282) // 120 seconds plus system time
  }

  @test
  async 'it should reset state when lock request rejects' () {
    WakeLock.sentinel = this.sentinel
    this.sentinel.released = true
    WakeLock.timeout = 1
    this.wakelockRequest.rejects('no you may not')
    await WakeLock.TakeLock()
    expect(WakeLock.sentinel).to.equal(null)
    expect(WakeLock.timeout).to.equal(0)
  }

  @test
  async 'it should reset state when lock request throws' () {
    WakeLock.sentinel = this.sentinel
    this.sentinel.released = true
    WakeLock.timeout = 1
    this.wakelockRequest.throws('no you may not')
    await WakeLock.TakeLock()
    expect(WakeLock.sentinel).to.equal(null)
    expect(WakeLock.timeout).to.equal(0)
  }

  @test
  async 'it should reset state when wakeLock not supported' () {
    WakeLock.sentinel = this.sentinel
    this.sentinel.released = true
    WakeLock.timeout = 1
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      get: () => undefined
    })
    await WakeLock.TakeLock()
    expect(WakeLock.sentinel).to.equal(null)
    expect(WakeLock.timeout).to.equal(0)
  }
}

@suite
export class WakeLockReleaseLockTests extends PubSub {
  clock: sinon.SinonFakeTimers | undefined
  sentinelRelease: sinon.SinonStub = sinon.stub()
  sentinel: WakeLockSentinel = {
    release: sinon.stub().resolves(),
    released: false
  }

  before () {
    this.clock = sinon.useFakeTimers()
    WakeLock.sentinel = null
    WakeLock.timeout = 0
    this.sentinelRelease = sinon.stub().resolves()
    this.sentinel = {
      release: this.sentinelRelease,
      released: false
    }
  }

  after () {
    this.clock?.restore()
  }

  @test
  async 'it should not release when sentinel is null' () {
    this.clock?.tick(100)
    WakeLock.timeout = 10
    WakeLock.sentinel = null
    await WakeLock.ReleaseLock()
    expect(WakeLock.timeout).to.equal(10)
  }

  @test
  async 'it should not release when timeout is not expired' () {
    this.clock?.tick(100)
    WakeLock.timeout = 110
    WakeLock.sentinel = this.sentinel
    await WakeLock.ReleaseLock()
    expect(WakeLock.timeout).to.equal(110)
    expect(this.sentinelRelease.callCount).to.equal(0)
  }

  @test
  async 'it should reset timeout when expired' () {
    this.clock?.tick(100)
    WakeLock.timeout = 10
    WakeLock.sentinel = this.sentinel
    await WakeLock.ReleaseLock()
    expect(WakeLock.timeout).to.equal(0)
  }

  @test
  async 'it should null released sentinel' () {
    this.clock?.tick(100)
    WakeLock.timeout = 10
    WakeLock.sentinel = this.sentinel
    await WakeLock.ReleaseLock()
    expect(WakeLock.sentinel).to.equal(null)
  }

  @test
  async 'it should release active sentinel when expired' () {
    this.clock?.tick(100)
    WakeLock.timeout = 10
    WakeLock.sentinel = this.sentinel
    await WakeLock.ReleaseLock()
    expect(this.sentinelRelease.callCount).to.equal(1)
  }

  @test
  async 'it should not release already released sentinel when expired' () {
    this.clock?.tick(100)
    WakeLock.timeout = 10
    WakeLock.sentinel = this.sentinel
    this.sentinel.released = true
    await WakeLock.ReleaseLock()
    expect(this.sentinelRelease.callCount).to.equal(0)
  }

  @test
  async 'it should handle when sentinel release rejects' () {
    this.clock?.tick(100)
    WakeLock.timeout = 10
    WakeLock.sentinel = this.sentinel
    this.sentinelRelease.rejects('fool!')
    await WakeLock.ReleaseLock()
    expect(WakeLock.sentinel).to.equal(null)
  }

  @test
  async 'it should handle when sentinel release throws' () {
    this.clock?.tick(100)
    WakeLock.timeout = 10
    WakeLock.sentinel = this.sentinel
    this.sentinelRelease.throws('fool!')
    await WakeLock.ReleaseLock()
    expect(WakeLock.sentinel).to.equal(null)
  }
}
