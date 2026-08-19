// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

import { expect } from 'chai'
import { deployCRISPProgram, deployMockLoxley, ethers } from './utils'

describe('CRISP Loxley binding', function () {
  it('binds once to the Loxley controller that registered the program', async function () {
    const [owner, other] = await ethers.getSigners()
    const mockLoxley = await deployMockLoxley()
    const program = await deployCRISPProgram({ mockLoxley, bindLoxley: false })
    const programAddress = await program.getAddress()
    const loxleyAddress = await mockLoxley.getAddress()

    expect(await program.owner()).to.equal(await owner.getAddress())
    expect(await program.loxley()).to.equal(ethers.ZeroAddress)

    await expect(program.connect(other).bindLoxley(loxleyAddress))
      .to.be.revertedWithCustomError(program, 'OwnableUnauthorizedAccount')
      .withArgs(await other.getAddress())
    await expect(program.bindLoxley(ethers.ZeroAddress)).to.be.revertedWithCustomError(program, 'LoxleyAddressZero')
    await expect(program.bindLoxley(await owner.getAddress())).to.be.revertedWithCustomError(program, 'LoxleyNotContract')
    await expect(program.bindLoxley(loxleyAddress)).to.be.revertedWithCustomError(program, 'ProgramNotRegistered')

    await (await mockLoxley.registerE3Program(programAddress)).wait()
    await expect(program.bindLoxley(loxleyAddress)).to.emit(program, 'LoxleyBound').withArgs(loxleyAddress)
    expect(await program.loxley()).to.equal(loxleyAddress)

    await expect(program.bindLoxley(loxleyAddress)).to.be.revertedWithCustomError(program, 'LoxleyAlreadyBound')
  })
})
