/* eslint-disable @typescript-eslint/no-explicit-any */
import { createThing, HomeAssistant, LovelaceCard, LovelaceCardConfig } from 'custom-card-helpers';
import { html, TemplateResult } from 'lit';
import { DEFAULT_ENTITY_CONF, UNIT_PREFIXES } from '../const';
import {
  Box,
  Config,
  Connection,
  ConnectionState,
  EnergyFlowCardPlusConfig,
  EntityConfigOrStr,
  Section,
  SectionConfig,
} from '../types';

export function cloneObj<T extends Record<string, unknown>>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function formatState(state: number, round: number): string {
  let rounded: string;
  let decimals = round;
  do {
    // round to first significant digit
    rounded = state.toFixed(decimals++);
  } while (/^[0\.]*$/.test(rounded) && decimals < 100);

  const formattedState = parseFloat(rounded).toLocaleString();
  return formattedState;
}

export function normalizeStateValue(
  unit_prefix: '' | keyof typeof UNIT_PREFIXES,
  state: number,
  unit_of_measurement?: string,
): { state: number; unit_of_measurement?: string } {
  const validState = Math.max(0, state);
  if (!unit_of_measurement) {
    return { state: validState, unit_of_measurement };
  }
  const prefix = Object.keys(UNIT_PREFIXES).find(p => unit_of_measurement!.indexOf(p) === 0) || '';
  const currentFactor = UNIT_PREFIXES[prefix] || 1;
  const targetFactor = UNIT_PREFIXES[unit_prefix] || 1;
  if (currentFactor === targetFactor) {
    return { state: validState, unit_of_measurement };
  }
  return {
    state: (validState * currentFactor) / targetFactor,
    unit_of_measurement: prefix ? unit_of_measurement.replace(prefix, unit_prefix) : unit_prefix + unit_of_measurement,
  };
}

export function getEntityId(entity: EntityConfigOrStr): string {
  return typeof entity === 'string' ? entity : entity.entity_id;
}

export function getChildConnections(parent: Box, children: Box[], connections?: ConnectionState[]): Connection[] {
  // @NOTE don't take prevParentState from connection because it is different
  let prevParentState = 0;
  return children.map(child => {
    const connection = connections?.find(c => c.child.entity_id === child.entity_id);
    if (!connection) {
      throw new Error(`Missing connection: ${parent.entity_id} - ${child.entity_id}`);
    }
    const { state, prevChildState } = connection;
    if (state <= 0) {
      // only continue if this connection will be rendered
      return { state } as Connection;
    }
    const startY = (prevParentState / parent.state) * parent.size + parent.top;
    prevParentState += state;
    const startSize = Math.max((state / parent.state) * parent.size, 0);
    const endY = (prevChildState / child.state) * child.size + child.top;
    const endSize = Math.max((state / child.state) * child.size, 0);

    return {
      startY,
      startSize,
      startColor: parent.color,
      endY,
      endSize,
      endColor: child.color,
      state,
      highlighted: connection.highlighted,
    };
  });
}


// private _showWarning(warning: string): TemplateResult {
//   return html`
//     <hui-warning>${warning}</hui-warning>
//   `;
// }

export async function renderError(
  error: string,
  origConfig?: LovelaceCardConfig,
  hass?: HomeAssistant,
): Promise<TemplateResult> {
  const config = {
    type: 'error',
    error,
    origConfig,
  };
  let element: LovelaceCard;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const HELPERS = (window as any).loadCardHelpers ? (window as any).loadCardHelpers() : undefined;
  if (HELPERS) {
    element = (await HELPERS).createCardElement(config);
  } else {
    element = createThing(config);
  }
  if (hass) {
    element.hass = hass;
  }

  return html` ${element} `;
}







/* eslint-disable no-redeclare */
export const round = (value: number, decimalPlaces: number): number =>
  Number(
    `${Math.round(Number(`${value}e${decimalPlaces}`))}e-${decimalPlaces}`
  );

/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export function isNumberValue(value: any): boolean {
  // parseFloat(value) handles most of the cases we're interested in (it treats null, empty string,
  // and other non-number values as NaN, where Number just uses 0) but it considers the string
  // '123hello' to be a valid number. Therefore we also check if Number(value) is NaN.
  // eslint-disable-next-line no-restricted-globals
  return !isNaN(parseFloat(value as any)) && !isNaN(Number(value));
}

export function coerceNumber(value: any): number;
export function coerceNumber<D>(value: any, fallback: D): number | D;
export function coerceNumber(value: any, fallbackValue = 0) {
  return isNumberValue(value) ? Number(value) : fallbackValue;
}

export function coerceStringArray(
  value: any,
  separator: string | RegExp = /\s+/
): string[] {
  const result: string[] = [];

  if (value != null) {
    const sourceValues = Array.isArray(value)
      ? value
      : `${value}`.split(separator);
    for (const sourceValue of sourceValues) {
      const trimmedString = `${sourceValue}`.trim();
      if (trimmedString) {
        result.push(trimmedString);
      }
    }
  }

  return result;
}
