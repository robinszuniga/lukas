import { afterEach, describe, expect, it } from 'vitest'
import {
  CURRENCIES, DEFAULT_CURRENCY, currencySymbol, formatMoney, formatWhileTyping, getCurrencyCode, parseMoney,
  plainAmount, setCurrencyCode, toInputAmount,
} from './money'
import { formatCOP, parseCOP } from './currency'

/** Intl usa espacios duros; se normalizan para comparar. */
const norm = (s: string) => s.replace(/\s/g, ' ')

afterEach(() => setCurrencyCode(DEFAULT_CURRENCY))

describe('moneda predeterminada', () => {
  it('es COP y es compatible con los datos existentes (enteros, sin centavos)', () => {
    expect(getCurrencyCode()).toBe('COP')
    expect(norm(formatMoney(654321))).toBe('$ 654.321')
    expect(norm(formatCOP(2500000))).toBe('$ 2.500.000')
  })

  it('no muestra NaN ni infinito', () => {
    expect(formatMoney(NaN)).toBe('—')
    expect(formatMoney(Infinity)).toBe('—')
  })
})

describe('parseMoney en moneda sin centavos (COP)', () => {
  it.each([
    ['12000', 12000],
    ['12.000', 12000],
    ['$ 1.234.567', 1234567],
    ['1,234,567', 1234567],
    ['12000,00', 12000],
    ['12.000,00', 12000],
    ['COP 45.000', 45000],
    [' 8000 ', 8000],
  ])('acepta %s', (text, expected) => {
    expect(parseMoney(text)).toBe(expected)
  })

  it.each(['', '   ', 'abc', '0', '-500', '12k', '12 mil', '1e5', '12.5', '12,50', '1.23', '1.234.56', '1.234,567', '9999999999999'])(
    'rechaza %s',
    (text) => {
      expect(parseMoney(text)).toBeNull()
    },
  )

  it('ya no convierte "12,50" en 1250 ni "12.5" en 125', () => {
    expect(parseCOP('12,50')).toBe(0)
    expect(parseCOP('12.5')).toBe(0)
  })

  it('acepta números directos y rechaza los inválidos', () => {
    expect(parseMoney(45000)).toBe(45000)
    expect(parseMoney(0)).toBeNull()
    expect(parseMoney(-1)).toBeNull()
    expect(parseMoney(Number.NaN)).toBeNull()
    expect(parseMoney(null)).toBeNull()
  })
})

describe('parseMoney en moneda con centavos (USD)', () => {
  it.each([
    ['12.50', 12.5],
    ['12,5', 12.5],
    ['1,234.50', 1234.5],
    ['1.234,50', 1234.5],
    ['US$ 3.75', 3.75],
    ['0.50', 0.5],
    ['1234', 1234],
    ['12.000', 12000],
  ])('acepta %s', (text, expected) => {
    expect(parseMoney(text, 'USD')).toBe(expected)
  })

  it('redondea a dos decimales', () => {
    expect(parseMoney(12.344, 'USD')).toBe(12.34)
  })
})

describe('cambio de moneda', () => {
  it('cambia el formato sin tocar el número guardado', () => {
    const stored = 1500
    setCurrencyCode('USD')
    expect(getCurrencyCode()).toBe('USD')
    expect(norm(formatMoney(stored))).toContain('1,500.00')
    setCurrencyCode('COP')
    expect(norm(formatMoney(stored))).toBe('$ 1.500')
  })

  it('rechaza monedas desconocidas', () => {
    expect(() => setCurrencyCode('XXX')).toThrow()
    expect(getCurrencyCode()).toBe('COP')
  })

  it('el símbolo junto al campo de monto sigue a la moneda', () => {
    expect(currencySymbol('COP')).toBe('$')
    expect(currencySymbol('EUR')).toBe('€')
    expect(currencySymbol('PEN')).toBe('S/')
  })

  it('todas las monedas de la lista formatean sin error', () => {
    for (const c of CURRENCIES) expect(formatMoney(1234.5, c.code)).toMatch(/\d/)
  })
})

describe('campos y exportación', () => {
  it('precarga montos como número simple', () => {
    expect(toInputAmount(654321)).toBe('654321')
    expect(toInputAmount(12.5, 'USD')).toBe('12.50')
    expect(toInputAmount(null)).toBe('')
    // Lo precargado se puede volver a leer igual
    expect(parseMoney(toInputAmount(654321))).toBe(654321)
    expect(parseMoney(toInputAmount(12.5, 'USD'), 'USD')).toBe(12.5)
  })

  it('exporta importes planos para CSV', () => {
    expect(plainAmount(12000)).toBe('12000')
    expect(plainAmount(12.5, 'USD')).toBe('12.50')
  })

  it('da formato de miles mientras se escribe', () => {
    expect(formatWhileTyping('12000')).toBe('12.000')
    expect(formatWhileTyping('1a2b3')).toBe('123')
    expect(formatWhileTyping('')).toBe('')
    expect(formatWhileTyping('12.5x', 'USD')).toBe('12.5')
  })
})
