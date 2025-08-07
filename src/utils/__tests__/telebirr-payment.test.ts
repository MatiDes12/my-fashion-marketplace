jest.mock('../../lib/telebirr/services', () => ({
  applyFabricToken: jest.fn(),
  createOrder: jest.fn()
}))

import { TelebirrPayment } from '../../lib/telebirr/payment'
import * as services from '../../lib/telebirr/services'

describe('TelebirrPayment', () => {
  it('creates order and returns payment url', async () => {
    jest.spyOn(services, 'applyFabricToken').mockResolvedValue({ token: 'tok' } as any)
    jest.spyOn(services, 'createOrder').mockResolvedValue('http://pay.test')
    const config = {
      baseUrl: 'b',
      webBaseUrl: 'w',
      merchantAppId: 'm',
      fabricAppId: 'f',
      appSecret: 'a',
      privateKey: 'p',
      shortCode: 's',
      notifyUrl: 'n',
      redirectUrl: 'r'
    }
    const tp = new TelebirrPayment(config as any)
    const url = await tp.createOrder({ title: 't', amount: '10' })
    expect(url).toBe('http://pay.test')
    expect(services.applyFabricToken).toHaveBeenCalled()
    expect(services.createOrder).toHaveBeenCalledWith(expect.objectContaining({ fabricToken: 'tok' }))
  })
})
