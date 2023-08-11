import { any, assign, boolean, integer, number, object, optional, string } from 'superstruct';
import { gridSchema } from './grid';
import { batterySchema } from './battery';
import { solarSchema } from './solar';
import { individualSchema } from './individual';
import { nonFossilSchema } from './fossil_fuel_percentage';
import { homeSchema } from './home';
import memoizeOne from 'memoize-one';

const baseLovelaceCardConfig = object({
  type: string(),
  view_layout: any(),
});

export const cardConfigStruct = assign(
  baseLovelaceCardConfig,
  object({
    title: optional(string()),
    theme: optional(string()),
    dashboard_link: optional(string()),
    dashboard_link_label: optional(string()),
    wh_decimals: optional(integer()),
    kwh_decimals: optional(integer()),
    mwh_decimals: optional(integer()),
    min_flow_rate: optional(number()),
    max_flow_rate: optional(number()),
    min_expected_energy: optional(number()),
    max_expected_energy: optional(number()),
    wh_kwh_threshold: optional(number()),
    kwh_mwh_threshold: optional(number()),
    clickable_entities: optional(boolean()),
    display_zero_lines: optional(boolean()),
    use_new_flow_rate_model: optional(boolean()),
    energy_date_selection: optional(boolean()),
    entities: object({
      battery: optional(any()),
      grid: optional(any()),
      solar: optional(any()),
      home: optional(any()),
      fossil_fuel_percentage: optional(any()),
      individual1: optional(any()),
      individual2: optional(any()),
    }),
  }),
);

export const generalConfigSchema = [
  {
    name: 'title',
    label: 'Title',
    selector: { text: {} },
  },
] as const;

export const entitiesSchema = memoizeOne(localize => [
  {
    name: 'entities',
    type: 'grid',
    column_min_width: '400px',
    schema: [
      {
        title: localize('editor.grid'),
        name: 'grid',
        type: 'expandable',
        schema: gridSchema,
      },
      {
        title: localize('editor.solar'),
        name: 'solar',
        type: 'expandable',
        schema: solarSchema,
      },
      {
        title: localize('editor.battery'),
        name: 'battery',
        type: 'expandable',
        schema: batterySchema,
      },
      {
        title: localize('editor.fossil_fuel_percentage'),
        name: 'fossil_fuel_percentage',
        type: 'expandable',
        schema: nonFossilSchema,
      },
      {
        title: localize('editor.home'),
        name: 'home',
        type: 'expandable',
        schema: homeSchema,
      },
      {
        title: `${localize('editor.individual')} 1`,
        name: 'individual1',
        type: 'expandable',
        schema: individualSchema,
      },
      {
        title: `${localize('editor.individual')} 2`,
        name: 'individual2',
        type: 'expandable',
        schema: individualSchema,
      },
    ],
  },
]);

export const advancedOptionsSchema = memoizeOne(localize => [
  {
    title: localize('editor.advanced'),
    type: 'expandable',
    schema: [
      {
        type: 'grid',
        column_min_width: '200px',
        schema: [
          {
            name: 'dashboard_link',
            label: 'Dashboard Link',
            selector: { navigation: {} },
          },
          {
            name: 'dashboard_link_label',
            label: 'Dashboard Link Label',
            selector: { text: {} },
          },
          {
            name: 'wh_decimals',
            label: 'Wh Decimals',
            selector: { number: { mode: 'box', min: 0, max: 5, step: 1 } },
          },
          {
            name: 'kwh_decimals',
            label: 'kWh Decimals',
            selector: { number: { mode: 'box', min: 0, max: 5, step: 1 } },
          },
          {
            name: 'mwh_decimals',
            label: 'MWh Decimals',
            selector: { number: { mode: 'box', min: 0, max: 5, step: 1 } },
          },
          {
            name: 'max_flow_rate',
            label: 'Max Flow Rate (Sec/Dot)',
            selector: { number: { mode: 'box', min: 0, max: 1000000, step: 0.01 } },
          },
          {
            name: 'min_flow_rate',
            label: 'Min Flow Rate (Sec/Dot)',
            selector: { number: { mode: 'box', min: 0, max: 1000000, step: 0.01 } },
          },
          {
            name: 'max_expected_energy',
            label: 'Max Expected Power (in Watts)',
            selector: { number: { mode: 'box', min: 0, max: 1000000, step: 0.01 } },
          },
          {
            name: 'min_expected_energy',
            label: 'Min Expected Power (in Watts)',
            selector: { number: { mode: 'box', min: 0, max: 1000000, step: 0.01 } },
          },
          {
            name: 'wh_kwh_threshold',
            label: 'Wh/kWh Threshold',
            selector: { number: { mode: 'box', min: 0, max: 1000000, step: 1 } },
          },
          {
            name: 'kwh_mwh_threshold',
            label: 'kWh/MWh Threshold',
            selector: { number: { mode: 'box', min: 0, max: 1000000, step: 1 } },
          },
          {
            name: 'display_zero_lines',
            label: 'Display Zero Lines',
            selector: { boolean: {} },
          },
          {
            name: 'clickable_entities',
            label: 'Clickable Entities',
            selector: { boolean: {} },
          },
          {
            name: 'energy_date_selection',
            label: 'Energy Date Selection',
            selector: { boolean: {} },
          },
          {
            name: 'use_new_flow_rate_model',
            label: 'New Flow Model?',
            selector: { boolean: {} },
          },
        ],
      },
    ],
  },
]);
