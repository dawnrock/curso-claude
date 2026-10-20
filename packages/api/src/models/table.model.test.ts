import { describe, it, expect } from 'vitest'
import {
    normalizeTableStatus,
    normalizeTableNumber,
    normalizeTableCapacity,
    normalizeTableDescription,
    normalizePeopleCount
} from './table.model.js'
import {
    InvalidTableStatusError,
    InvalidTableNumberError,
    InvalidTableCapacityError,
    InvalidPeopleCountError
} from '@errors/DomainErrors.js'

describe('table.model', () => {
    describe('normalizeTableStatus', () => {
        it('should accept every valid status', () => {
            expect(normalizeTableStatus('libre')).toBe('libre')
            expect(normalizeTableStatus('ocupada')).toBe('ocupada')
            expect(normalizeTableStatus('reservada')).toBe('reservada')
        })

        it('should lowercase and trim the status', () => {
            expect(normalizeTableStatus('  OCUPADA ')).toBe('ocupada')
        })

        it('should throw InvalidTableStatusError for an unknown status', () => {
            expect(() => normalizeTableStatus('sucia')).toThrow(InvalidTableStatusError)
            expect(() => normalizeTableStatus('sucia')).toThrow('Invalid table status: sucia. Must be one of: libre, ocupada, reservada')
        })

        it('should throw InvalidTableStatusError for a non-string value', () => {
            expect(() => normalizeTableStatus(undefined)).toThrow(InvalidTableStatusError)
            expect(() => normalizeTableStatus(3)).toThrow(InvalidTableStatusError)
        })
    })

    describe('normalizeTableNumber', () => {
        it('should accept integers >= 1', () => {
            expect(normalizeTableNumber(1)).toBe(1)
            expect(normalizeTableNumber(42)).toBe(42)
        })

        it.each([0, -1, 1.5, '4', null, undefined])('should reject %s', (value) => {
            expect(() => normalizeTableNumber(value)).toThrow(InvalidTableNumberError)
        })
    })

    describe('normalizeTableCapacity', () => {
        it('should accept integers >= 1', () => {
            expect(normalizeTableCapacity(1)).toBe(1)
            expect(normalizeTableCapacity(8)).toBe(8)
        })

        it.each([0, -2, 2.5, '4', null, undefined])('should reject %s', (value) => {
            expect(() => normalizeTableCapacity(value)).toThrow(InvalidTableCapacityError)
        })
    })

    describe('normalizeTableDescription', () => {
        it('should trim the description', () => {
            expect(normalizeTableDescription('  Terraza ')).toBe('Terraza')
        })

        it('should return null for missing or empty descriptions', () => {
            expect(normalizeTableDescription(undefined)).toBeNull()
            expect(normalizeTableDescription(null)).toBeNull()
            expect(normalizeTableDescription('   ')).toBeNull()
        })
    })

    describe('normalizePeopleCount', () => {
        it('should accept integers >= 1', () => {
            expect(normalizePeopleCount(3)).toBe(3)
        })

        it('should accept numeric strings (query params)', () => {
            expect(normalizePeopleCount('3')).toBe(3)
        })

        it.each([0, -1, 1.5, '1.5', 'abc', '', null, undefined])('should reject %s', (value) => {
            expect(() => normalizePeopleCount(value)).toThrow(InvalidPeopleCountError)
        })
    })
})
