// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

import { expect } from 'chai'
import { deployCRISPProgram, deployMockBracken, ethers } from './utils'

describe('CRISP Bracken binding', function () {
  it('binds once to the Bracken controller that registered the program', async function () {
    const [owner, other] = await ethers.getSigners()
    const mockBracken = await deployMockBracken()
    const program = await deployCRISPProgram({ mockBracken, bindBracken: false })
    const programAddress = await program.getAddress()
    const brackenAddress = await mockBracken.getAddress()

    expect(await program.owner()).to.equal(await owner.getAddress())
    expect(await program.bracken()).to.equal(ethers.ZeroAddress)

    await expect(program.connect(other).bindBracken(brackenAddress))
      .to.be.revertedWithCustomError(program, 'OwnableUnauthorizedAccount')
      .withArgs(await other.getAddress())
    await expect(program.bindBracken(ethers.ZeroAddress)).to.be.revertedWithCustomError(program, 'BrackenAddressZero')
    await expect(program.bindBracken(await owner.getAddress())).to.be.revertedWithCustomError(program, 'BrackenNotContract')
    await expect(program.bindBracken(brackenAddress)).to.be.revertedWithCustomError(program, 'ProgramNotRegistered')

    await (await mockBracken.registerE3Program(programAddress)).wait()
    await expect(program.bindBracken(brackenAddress)).to.emit(program, 'BrackenBound').withArgs(brackenAddress)
    expect(await program.bracken()).to.equal(brackenAddress)

    await expect(program.bindBracken(brackenAddress)).to.be.revertedWithCustomError(program, 'BrackenAlreadyBound')
  })
})
