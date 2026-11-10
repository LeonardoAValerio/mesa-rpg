import { expect, test } from '@playwright/test'
import { closeAll, masterAndPlayer, showPanel } from './helpers'

test.afterEach(closeAll)

test('[C55] CHAT-01 Ana sends "olá" and both windows show "Ana: olá"', async () => {
  const { master, player } = await masterAndPlayer('Ana')
  await showPanel(master.page, 'dados')
  await player.page.getByTestId('chat-input').fill('olá')
  await player.page.getByTestId('chat-send').click()
  for (const page of [master.page, player.page]) await expect(page.getByTestId('log-entry').last()).toHaveText('Ana: olá')
  await expect(player.page.getByTestId('chat-input')).toHaveValue('')
})

test('[C58] CHAT-04 `<b>oi</b>` shows the angle brackets as text, with no `b` element', async () => {
  const { master, player } = await masterAndPlayer('Ana')
  await showPanel(master.page, 'dados')
  await player.page.getByTestId('chat-input').fill('<b>oi</b><img src=x onerror=alert(1)>')
  await player.page.getByTestId('chat-input').press('Enter')
  for (const page of [master.page, player.page]) {
    await expect(page.getByTestId('log-entry').last()).toHaveText('Ana: <b>oi</b><img src=x onerror=alert(1)>')
    await expect(page.getByTestId('log').locator('b, img')).toHaveCount(0)
  }
})

test('a roll shows each die, the dropped one marked, and the total in both windows (DICE-01, DICE-03)', async () => {
  const { master, player } = await masterAndPlayer('Ana')
  await showPanel(master.page, 'dados')
  await player.page.getByTestId('dice-input').fill('2d20kh1+5')
  await player.page.getByTestId('dice-roll').click()
  for (const page of [master.page, player.page]) {
    const entry = page.getByTestId('log-entry').last()
    await expect(entry).toContainText('Ana rolou 2d20kh1+5:')
    await expect(entry.getByTestId('die')).toHaveCount(1)
    await expect(entry.getByTestId('die-dropped')).toHaveCount(1)
    const kept = Number(await entry.getByTestId('die').textContent())
    const dropped = Number(await entry.getByTestId('die-dropped').textContent())
    expect(kept).toBeGreaterThanOrEqual(dropped)
    await expect(entry.getByTestId('roll-total')).toHaveText(String(kept + 5))
  }
})

test('invalid notation shows "Notação inválida: 2d" and adds nothing to the log (DICE-04)', async () => {
  const { player } = await masterAndPlayer('Ana')
  await player.page.getByTestId('dice-input').fill('2d')
  await player.page.getByTestId('dice-roll').click()
  await expect(player.page.getByTestId('dice-error')).toHaveText('Notação inválida: 2d')
  await expect(player.page.getByTestId('log-entry')).toHaveCount(0)
})

test('an empty or 501-character message is not sent (CHAT-02)', async () => {
  const { master, player } = await masterAndPlayer('Ana')
  await showPanel(master.page, 'dados')
  await player.page.getByTestId('chat-input').fill('   ')
  await player.page.getByTestId('chat-send').click()
  await player.page.getByTestId('chat-input').evaluate((el: HTMLInputElement) => {
    el.removeAttribute('maxlength')
    el.value = 'x'.repeat(501)
  })
  await player.page.getByTestId('chat-send').click()
  await player.page.waitForTimeout(300)
  await expect(master.page.getByTestId('log-entry')).toHaveCount(0)
})
