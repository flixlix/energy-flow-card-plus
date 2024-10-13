/* eslint-disable @typescript-eslint/no-explicit-any */
import { LitElement, html, TemplateResult, svg, PropertyValues } from 'lit';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { customElement, property, query, state } from 'lit/decorators';
import type { Config, EntityType, baseEntity } from './types';
import localize from './localize/localize';
import { coerceNumber, coerceStringArray, isNumberValue, renderError } from './utils';
import { SubscribeMixin } from './energy/subscribe-mixin';
import { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { EnergyCollection, EnergyData, getEnergyDataCollection, getStatistics } from './energy/index';
import { HomeAssistantReal } from './hass';
import { HomeAssistant, LovelaceCardEditor, formatNumber, round } from 'custom-card-helpers';
import { classMap } from 'lit/directives/class-map.js';
import { registerCustomCard } from './utils/register-custom-card';
import { logError } from './logging';
import { styles } from './style';
import { defaultValues, getDefaultConfig } from './utils/get-default-config';
import getElementWidth from './utils/get-element-width';
import { EntitiesConfig, EnergyFlowCardPlusConfig } from './energy-flow-card-plus-config';

registerCustomCard({
  type: 'energy-flow-card-plus',
  name: 'Energy Flow Card Plus',
  description: 'A custom card for displaying energy flow in Home Assistant. Inspired by the official Energy Distribution Card.',
});

const energyDataTimeout = 10000;
const circleCircumference = 238.76104;

@customElement('energy-flow-card-plus')
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default class EnergyFlowCardPlus extends SubscribeMixin(LitElement) {
  public static getStubConfig(hass: HomeAssistant): Record<string, unknown> {
    // get available energy entities
    return getDefaultConfig(hass);
  }

  // https://lit.dev/docs/components/properties/
  @property({ attribute: false }) public hass!: HomeAssistantReal;

  @state() private _config!: EnergyFlowCardPlusConfig;
  @state() private states: HassEntities = {};
  @state() private entitiesArr: string[] = [];
  @state() private error?: Error | unknown;
  @state() private _data?: EnergyData;
  @state() private _width = 0;

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('./ui-editor/ui-editor');
    return document.createElement('energy-flow-card-plus-editor');
  }

  public hassSubscribe() {
    if (this._config?.energy_date_selection === false) {
      return [];
    }
    const start = Date.now();
    const getEnergyDataCollectionPoll = (
      resolve: (value: EnergyCollection | PromiseLike<EnergyCollection>) => void,
      reject: (reason?: any) => void,
    ) => {
      const energyCollection = getEnergyDataCollection(this.hass);
      if (energyCollection) {
        resolve(energyCollection);
      } else if (Date.now() - start > energyDataTimeout) {
        console.debug(getEnergyDataCollection(this.hass));
        reject(new Error('No energy data received. Make sure to add a `type: energy-date-selection` card to this screen.'));
      } else {
        setTimeout(() => getEnergyDataCollectionPoll(resolve, reject), 100);
      }
    };
    const energyPromise = new Promise<EnergyCollection>(getEnergyDataCollectionPoll);
    setTimeout(() => {
      if (!this.error && !Object.keys(this.states).length) {
        this.error = new Error('Something went wrong. No energy data received.');
        console.debug(getEnergyDataCollection(this.hass));
      }
    }, energyDataTimeout * 2);
    energyPromise.catch(err => {
      this.error = err;
    });
    return [
      energyPromise.then(async collection => {
        return collection.subscribe(async data => {
          this._data = data;
          if (this.entitiesArr) {
            const stats = await getStatistics(this.hass, data, this.entitiesArr);
            const states: HassEntities = {};
            Object.keys(stats).forEach(id => {
              if (this.hass.states[id]) {
                states[id] = { ...this.hass.states[id], state: String(stats[id]) };
              }
            });
            this.states = states;
          }
        });
      }),
    ];
  }

  public setConfig(config: EnergyFlowCardPlusConfig): void {
    if (typeof config !== 'object') {
      throw new Error(localize('common.invalid_configuration'));
    } else if (!config.entities || (!config.entities?.battery?.entity && !config.entities?.grid?.entity && !config.entities?.solar?.entity)) {
      throw new Error('At least one entity for battery, grid or solar must be defined');
    }
    this._config = {
      ...config,
      min_flow_rate: coerceNumber(config.min_flow_rate, defaultValues.minFlowRate),
      max_flow_rate: coerceNumber(config.max_flow_rate, defaultValues.maxFlowRate),
      wh_decimals: coerceNumber(config.wh_decimals, defaultValues.watthourDecimals),
      kwh_decimals: coerceNumber(config.kwh_decimals, defaultValues.kilowatthourDecimals),
      mwh_decimals: coerceNumber(config.mwh_decimals, defaultValues.megawatthourDecimals),
      wh_kwh_threshold: coerceNumber(config.wh_kwh_threshold, defaultValues.whkWhThreshold),
      kwh_mwh_threshold: coerceNumber(config.kwh_mwh_threshold, defaultValues.kwhMwhThreshold),
      max_expected_energy: coerceNumber(config.max_expected_energy, defaultValues.maxExpectedEnergy),
      min_expected_energy: coerceNumber(config.min_expected_energy, defaultValues.minExpectedEnergy),
    };

    this.populateEntitiesArr();
    this.resetSubscriptions();
  }

  private populateEntitiesArr(): void {
    this.entitiesArr = [];
    /* loop through entities object in config */
    Object.keys(this._config?.entities).forEach(entity => {
      if (typeof this._config.entities[entity].entity === 'string' || Array.isArray(this._config.entities[entity].entity)) {
        if (Array.isArray(this._config.entities[entity].entity)) {
          this._config.entities[entity].entity.forEach((entityId: string) => {
            this.entitiesArr.push(entityId);
          });
        } else {
          this.entitiesArr.push(this._config.entities[entity].entity);
        }
      } else if (typeof this._config.entities[entity].entity === 'object') {
        if (Array.isArray(this._config.entities[entity].entity?.consumption)) {
          this._config.entities[entity].entity?.consumption.forEach((entityId: string) => {
            this.entitiesArr.push(entityId);
          });
        } else {
          this.entitiesArr.push(this._config.entities[entity].entity?.consumption);
        }
        if (Array.isArray(this._config.entities[entity].entity?.production)) {
          this._config.entities[entity].entity?.production.forEach((entityId: string) => {
            this.entitiesArr.push(entityId);
          });
        } else {
          this.entitiesArr.push(this._config.entities[entity].entity?.production);
        }
      }
    });
    this.entitiesArr = this.entitiesArr.filter(entity => entity !== undefined);
  }

  public getCardSize(): Promise<number> | number {
    return 3;
  }
  private unavailableOrMisconfiguredError = (entityId: string | undefined) =>
    logError(`Entity "${entityId ?? 'Unknown'}" is not available or misconfigured`);

  private entityExists = (entityId: string): boolean => {
    return entityId in this.hass.states;
  };

  private entityAvailable = (entityId: string, instantaneousValue?: boolean): boolean => {
    if (this._config?.energy_date_selection && instantaneousValue !== true) {
      return isNumberValue(this.states[entityId]?.state);
    }
    return isNumberValue(this.hass.states[entityId]?.state);
  };

  private entityInverted = (entityType: EntityType) => !!this._config.entities[entityType]?.invert_state;

  private previousDur: { [name: string]: number } = {};

  private mapRange(value: number, minOut: number, maxOut: number, minIn: number, maxIn: number): number {
    if (value > maxIn) return maxOut;
    return ((value - minIn) * (maxOut - minOut)) / (maxIn - minIn) + minOut;
  }

  private circleRate = (value: number, total: number): number => {
    const maxRate = this._config.max_flow_rate!;
    const minRate = this._config.min_flow_rate!;
    if (this._config.use_new_flow_rate_model) {
      const maxEnergy = this._config.max_expected_energy!;
      const minEnergy = this._config.min_expected_energy!;
      return this.mapRange(value, maxRate, minRate, minEnergy, maxEnergy);
    }
    return maxRate - (value / total) * (maxRate - minRate);
  };

  private getEntityStateObj = (entity: string | undefined): HassEntity | undefined => {
    if (!entity || !this.entityAvailable(entity, true)) {
      this.unavailableOrMisconfiguredError(entity);
      return undefined;
    }
    return this.hass.states[entity];
  };

  private additionalCircleRate = (entry?: boolean | number, value?: number) => {
    if (entry === true && value) {
      return value;
    }
    if (isNumberValue(entry)) {
      return entry;
    }
    return 1.66;
  };

  private getEntityState = (entity: string | undefined, instantaneousValue?: boolean): number => {
    if (!entity || !this.entityAvailable(entity, instantaneousValue)) {
      this.unavailableOrMisconfiguredError(entity);
      return 0;
    }
    const stateObj = this._config?.energy_date_selection !== false && !instantaneousValue ? this.states[entity] : this.hass?.states[entity];
    return coerceNumber(stateObj.state);
  };

  private getEntityStateWatthours = (entity: baseEntity | undefined, instantaneousValue?: boolean): number => {
    let entityArr: string[] = [];
    if (typeof entity === 'string') {
      entityArr.push(entity);
    } else if (Array.isArray(entity)) {
      entityArr = entity;
    }
    const valuesArr: number[] = entityArr.map(entity => {
      if (!entity || !this.entityAvailable(entity)) {
        this.unavailableOrMisconfiguredError(entity);
      }
      let stateObj: HassEntity | undefined;
      if (instantaneousValue === undefined) {
        stateObj = this._config.energy_date_selection !== false ? this.states[entity] : this.hass?.states[entity];
      } else if (instantaneousValue) {
        stateObj = this.hass?.states[entity];
      } else {
        stateObj = this.states[entity];
      }
      const value = coerceNumber(stateObj?.state);
      if (stateObj?.attributes.unit_of_measurement?.toUpperCase().startsWith('KWH')) return value * 1000; // case insensitive check `KWH`
      else if (stateObj?.attributes.unit_of_measurement?.toUpperCase().startsWith('MWH')) return value * 1000000; // case insensitive check `MWH`
      return value;
    });
    const sum = valuesArr.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
    return sum;
  };

  /**
   * Return a string to display with value and unit.
   * @param value - value to display (if text, will be returned as is)
   * @param unit - unit to display (default is dynamic)
   * @param unitWhiteSpace - wether add space between value and unit (default true)
   * @param decimals - number of decimals to display (default is user defined)
   */
  private displayValue = (
    value: number | string | null,
    unit?: string | undefined,
    unitWhiteSpace?: boolean | undefined,
    decimals?: number | undefined,
  ): string => {
    if (value === null) return '0';
    if (Number.isNaN(+value)) return value.toString();
    const valueInNumber = Number(value);
    const isMwh = unit === undefined && valueInNumber * 1000 >= this._config!.kwh_mwh_threshold!;
    const isKWh = unit === undefined && valueInNumber >= this._config!.wh_kwh_threshold!;
    const v = formatNumber(
      isMwh
        ? round(valueInNumber / 1000000, this._config!.mwh_decimals)
        : isKWh
        ? round(valueInNumber / 1000, this._config!.kwh_decimals)
        : round(valueInNumber, decimals ?? this._config!.wh_decimals),
      this.hass.locale,
    );
    return `${v}${unitWhiteSpace === false ? '' : ' '}${unit || (isMwh ? 'MWh' : isKWh ? 'kWh' : 'Wh')}`;
  };

  private openDetails(event: { stopPropagation: any; key?: string }, entityId?: string | undefined): void {
    event.stopPropagation();
    if (!entityId || !this._config.clickable_entities) return;
    /* also needs to open details if entity is unavailable, but not if entity doesn't exist is hass states */
    if (!this.entityExists(entityId)) return;
    const e = new CustomEvent('hass-more-info', {
      composed: true,
      detail: { entityId },
    });
    this.dispatchEvent(e);
  }

  private hasField(field?: any, acceptStringState?: boolean): boolean {
    return (
      (field !== undefined && field?.display_zero === true) ||
      (this.getEntityStateWatthours(field?.entity) > (field?.display_zero_tolerance ?? 0) && Array.isArray(field?.entity)
        ? this.entityAvailable(field?.mainEntity)
        : this.entityAvailable(field?.entity)) ||
      acceptStringState
        ? typeof this.hass.states[field?.entity]?.state === 'string'
        : false
    ) as boolean;
  }

  /**
   * Depending on if the user has decided to show inactive lines, decide if this line should be shown.
   * @param energy - energy value to check
   * @returns boolean to decide if line should be shown (true = show, false = don't show)
   */
  private showLine(energy: number): boolean {
    if (this._config?.display_zero_lines !== false) return true;
    return energy > 0;
  }

  /**
   * Depending on if the user has defined the icon or wants to use the entity icon, return the icon to display.
   * @param field - field object (eg: solar) OBJECT
   * @param fallback - fallback icon (eg: mdi:solar-power)
   * @returns icon to display in format mdi:icon
   */
  private computeFieldIcon(field: any, fallback: string): string {
    if (field?.icon) return field.icon;
    if (field?.use_metadata) return this.getEntityStateObj(field.entity)?.attributes?.icon || '';
    return fallback;
  }

  /**
   * Depending on if the user has defined the name or wants to use the entity name, return the name to display.
   * @param field - field object (eg: solar) OBJECT
   * @param fallback - fallback name (eg: Solar)
   * @returns name to display
   */
  private computeFieldName(field: any, fallback: string): string {
    if (field?.name) return field.name;
    if (field?.use_metadata) return this.getEntityStateObj(field.entity)?.attributes?.friendly_name || '';
    return fallback;
  }

  /**
   * Convert a an array of values in the format [r, g, b] to a hex color.
   * @param colorList - array of values in the format [r, g, b]
   * @returns hex color
   * @example
   * convertColorListToHex([255, 255, 255]) // returns #ffffff
   * convertColorListToHex([0, 0, 0]) // returns #000000
   */
  private convertColorListToHex(colorList: number[]): string {
    return '#'.concat(colorList.map(x => x.toString(16).padStart(2, '0')).join(''));
  }

  private getSecondaryState = (
    field: {
      entity: any;
      template?: string | undefined;
      has: any;
      state?: string | number | null;
      icon?: string | undefined;
      unit?: string | undefined;
      unit_white_space?: boolean | undefined;
      displayZero?: boolean | undefined;
      displayZeroTolerance?: number | undefined;
      energyDateSelection?: boolean;
    },
    name: EntityType,
  ): string | number | null => {
    if (field.has) {
      const secondaryEntity = field?.entity;
      const wantsInstantaneousValue = field?.energyDateSelection !== true;
      const secondaryState = secondaryEntity && this.getEntityStateWatthours(secondaryEntity, wantsInstantaneousValue);
      if (typeof secondaryState === 'number') return secondaryState * (this.entityInverted(name) ? -1 : 1);
      if (typeof secondaryState === 'string') return secondaryState;
    }
    return null;
  };

  protected render(): TemplateResult {
    if (!this._config || !this.hass) {
      return html``;
    }

    if (!this._data && this._config.energy_date_selection !== false) {
      return html`<ha-card style="padding: 2rem">
        ${this.hass.localize('ui.panel.lovelace.cards.energy.loading')}<br />Make sure you have the Energy Integration setup and a Date Selector in
        this View or set
        <pre>energy_date_selection: false</pre>
        .</ha-card
      >`;
    }

    const entities = this._config.entities;

    this.style.setProperty(
      '--clickable-cursor',
      this._config.clickable_entities ? 'pointer' : 'default',
    ); /* show pointer if clickable entities is enabled */

    const initialNumericState = null as null | number;
    const initialSecondaryState = null as null | string | number;

    // Create initial objects for each field

    const grid = {
      entity: entities.grid?.entity,
      has: entities?.grid?.entity !== undefined,
      hasReturnToGrid: !!entities.grid?.entity?.production,
      state: {
        fromGrid: 0, // consumption
        toGrid: initialNumericState, // production
        toBattery: initialNumericState, // production to battery only
        toHome: initialNumericState, // production to home only
      },
      powerOutage: {
        has: this.hasField(entities.grid?.power_outage, true),
        isOutage:
          (entities.grid && entities.grid.power_outage?.entity && this.hass.states[entities.grid.power_outage.entity]?.state) ===
          (entities.grid?.power_outage?.state_alert ?? 'on'),
        icon: entities.grid?.power_outage?.icon_alert || 'mdi:transmission-tower-off',
        name: entities.grid?.power_outage?.label_alert ?? html`Power<br />Outage`,
      },
      icon: this.computeFieldIcon(entities.grid, 'mdi:transmission-tower'),
      name: this.computeFieldName(entities.grid, this.hass.localize('ui.panel.lovelace.cards.energy.energy_distribution.grid')) as
        | string
        | TemplateResult<1>,
      mainEntity: Array.isArray(entities?.grid?.entity?.consumption)
        ? entities?.grid?.entity?.consumption[0]
        : typeof entities?.grid?.entity?.consumption === 'string'
        ? entities?.grid?.entity?.consumption
        : Array.isArray(entities?.grid?.entity?.production)
        ? entities?.grid?.entity?.production[0]
        : typeof entities?.grid?.entity?.production === 'string'
        ? entities?.grid?.entity?.production
        : undefined,
      color: {
        fromGrid: entities.grid?.color?.consumption,
        toGrid: entities.grid?.color?.production,
        icon_type: entities.grid?.color_icon,
        circle_type: entities.grid?.color_circle,
      },
      secondary: {
        entity: entities.grid?.secondary_info?.entity,
        template: entities.grid?.secondary_info?.template,
        has: this.hasField(entities.grid?.secondary_info, true),
        state: initialSecondaryState,
        icon: entities.grid?.secondary_info?.icon,
        unit: entities.grid?.secondary_info?.unit_of_measurement,
        unit_white_space: entities.grid?.secondary_info?.unit_white_space,
        decimals: entities.grid?.secondary_info?.decimals,
        energyDateSelection: entities.grid?.secondary_info?.energy_date_selection || false,
        color: {
          type: entities.grid?.secondary_info?.color_value,
        },
      },
    };

    const solar = {
      entity: entities.solar?.entity as string | undefined,
      mainEntity: Array.isArray(entities.solar?.entity) ? entities.solar?.entity[0] : entities.solar?.entity,
      has: entities.solar?.entity !== undefined,
      state: {
        total: initialNumericState,
        toHome: initialNumericState, // aka solar consumption
        toGrid: initialNumericState,
        toBattery: initialNumericState,
      },
      icon: this.computeFieldIcon(entities.solar, 'mdi:solar-power'),
      name: this.computeFieldName(entities.solar, this.hass.localize('ui.panel.lovelace.cards.energy.energy_distribution.solar')),
      secondary: {
        entity: entities.solar?.secondary_info?.entity,
        template: entities.solar?.secondary_info?.template,
        has: this.hasField(entities.solar?.secondary_info, true),
        state: initialSecondaryState,
        icon: entities.solar?.secondary_info?.icon,
        unit: entities.solar?.secondary_info?.unit_of_measurement,
        decimals: entities.solar?.secondary_info?.decimals,
        unit_white_space: entities.solar?.secondary_info?.unit_white_space,
        energyDateSelection: entities.solar?.secondary_info?.energy_date_selection || false,
      },
    };

    const battery = {
      entity: entities.battery?.entity,
      has: entities?.battery?.entity !== undefined,
      mainEntity: typeof entities.battery?.entity === 'object' ? entities.battery.entity.consumption : entities.battery?.entity,
      name: this.computeFieldName(entities.battery, this.hass.localize('ui.panel.lovelace.cards.energy.energy_distribution.battery')),
      icon: this.computeFieldIcon(entities.battery, 'mdi:battery-high'),
      state_of_charge: {
        state: entities.battery?.state_of_charge?.length ? this.getEntityState(entities.battery?.state_of_charge) : null,
        unit: entities?.battery?.state_of_charge_unit || '%',
        unit_white_space: entities?.battery?.state_of_charge_unit_white_space || true,
        decimals: entities?.battery?.state_of_charge_decimals || 0,
      },
      state: {
        toBattery: 0, // Production, battery in
        fromBattery: 0, // Consumption, battery out
        toGrid: 0, // Production only to Grid, battery out to Grid
        toHome: 0, // Consumption, battery out to Home aka battery consumption
      },
      color: {
        fromBattery: entities.battery?.color?.consumption,
        toBattery: entities.battery?.color?.production,
        icon_type: undefined as string | boolean | undefined,
        circle_type: entities.battery?.color_circle,
        state_of_charge_type: entities.battery?.color_state_of_charge_value,
      },
    };

    const home = {
      entity: entities.home?.entity,
      mainEntity: Array.isArray(entities.home?.entity) ? entities.home?.entity[0] : entities.home?.entity,
      has: entities?.home?.entity !== undefined,
      state: initialNumericState,
      icon: this.computeFieldIcon(entities?.home, 'mdi:home'),
      name: this.computeFieldName(entities?.home, this.hass.localize('ui.panel.lovelace.cards.energy.energy_distribution.home')),
      color: {
        icon_type: entities.home?.color_icon,
      },
      secondary: {
        entity: entities.home?.secondary_info?.entity,
        template: entities.home?.secondary_info?.template,
        has: this.hasField(entities.home?.secondary_info, true),
        state: null as number | string | null,
        unit: entities.home?.secondary_info?.unit_of_measurement,
        unit_white_space: entities.home?.secondary_info?.unit_white_space,
        icon: entities.home?.secondary_info?.icon,
        decimals: entities.home?.secondary_info?.decimals,
        energyDateSelection: entities.home?.secondary_info?.energy_date_selection || false,
      },
    };

    const getIndividualObject = (field: 'individual1' | 'individual2') => ({
      entity: entities[field]?.entity,
      mainEntity: Array.isArray(entities[field]?.entity) ? entities[field]?.entity[0] : (entities[field]?.entity as string | undefined),
      has: this.hasField(entities[field]),
      displayZero: entities[field]?.display_zero,
      displayZeroTolerance: entities[field]?.display_zero_tolerance,
      state: initialNumericState,
      icon: this.computeFieldIcon(entities[field], field === 'individual1' ? 'mdi:car-electric' : 'mdi:motorbike-electric'),
      name: this.computeFieldName(entities[field], field === 'individual1' ? localize('card.label.car') : localize('card.label.motorbike')),
      color: entities[field]?.color,
      unit: entities[field]?.unit_of_measurement,
      unit_white_space: entities[field]?.unit_white_space,
      decimals: entities[field]?.decimals,
      invertAnimation: entities[field]?.inverted_animation || false,
      showDirection: entities[field]?.show_direction || false,
      secondary: {
        entity: entities[field]?.secondary_info?.entity,
        template: entities[field]?.secondary_info?.template,
        has: this.hasField(entities[field]?.secondary_info, true),
        state: initialSecondaryState,
        icon: entities[field]?.secondary_info?.icon,
        unit: entities[field]?.secondary_info?.unit_of_measurement,
        unit_white_space: entities[field]?.secondary_info?.unit_white_space,
        displayZero: entities[field]?.secondary_info?.display_zero,
        decimals: entities[field]?.secondary_info?.decimals,
        displayZeroTolerance: entities[field]?.secondary_info?.display_zero_tolerance,
        energyDateSelection: entities[field]?.secondary_info?.energy_date_selection || false,
      },
    });

    const individual1 = getIndividualObject('individual1');

    const individual2 = getIndividualObject('individual2');

    type Individual = typeof individual2 & typeof individual1;

    const nonFossil = {
      entity: entities.fossil_fuel_percentage?.entity,
      mainEntity: Array.isArray(entities.fossil_fuel_percentage?.entity)
        ? entities.fossil_fuel_percentage?.entity[0]
        : entities.fossil_fuel_percentage?.entity,
      name:
        entities.fossil_fuel_percentage?.name ||
        (entities.fossil_fuel_percentage?.use_metadata && this.getEntityStateObj(entities.fossil_fuel_percentage.entity)?.attributes.friendly_name) ||
        this.hass.localize('ui.panel.lovelace.cards.energy.energy_distribution.low_carbon'),
      icon:
        entities.fossil_fuel_percentage?.icon ||
        (entities.fossil_fuel_percentage?.use_metadata && this.getEntityStateObj(entities.fossil_fuel_percentage.entity)?.attributes?.icon) ||
        'mdi:leaf',
      has: false,
      hasPercentage: false,
      state: {
        power: initialNumericState,
      },
      color: entities.fossil_fuel_percentage?.color,
      color_value: entities.fossil_fuel_percentage?.color_value,
      secondary: {
        entity: entities.fossil_fuel_percentage?.secondary_info?.entity,
        template: entities.fossil_fuel_percentage?.secondary_info?.template,
        has: this.hasField(entities.fossil_fuel_percentage?.secondary_info, true),
        state: initialSecondaryState,
        icon: entities.fossil_fuel_percentage?.secondary_info?.icon,
        unit: entities.fossil_fuel_percentage?.secondary_info?.unit_of_measurement,
        unit_white_space: entities.fossil_fuel_percentage?.secondary_info?.unit_white_space,
        color_value: entities.fossil_fuel_percentage?.secondary_info?.color_value,
        energyDateSelection: entities.fossil_fuel_percentage?.secondary_info?.energy_date_selection || false,
      },
    };

    // Override in case of Power Outage
    if (grid.powerOutage.isOutage) {
      grid.state.fromGrid = 0;
      grid.state.toGrid = 0;
      grid.icon = grid.powerOutage.icon;
    }

    // Update Color of Grid Consumption
    if (grid.color.fromGrid !== undefined) {
      if (typeof grid.color.fromGrid === 'object') {
        grid.color.fromGrid = this.convertColorListToHex(grid.color.fromGrid);
      }
      this.style.setProperty('--energy-grid-consumption-color', grid.color.fromGrid || 'var(--energy-grid-consumption-color)' || '#488fc2');
    }

    // Update States Values of Grid Consumption
    if (grid.has) {
      if (typeof entities.grid!.entity === 'string') {
        if (this.entityInverted('grid')) {
          grid.state.fromGrid = Math.abs(Math.min(this.getEntityStateWatthours(entities.grid?.entity), 0));
        } else {
          grid.state.fromGrid = Math.max(this.getEntityStateWatthours(entities.grid?.entity), 0);
        }
      } else {
        grid.state.fromGrid = this.getEntityStateWatthours(entities.grid!.entity!.consumption);
      }
    }
    // Reset Grid Consumption if it is below the tolerance
    if (entities.grid?.display_zero_tolerance !== undefined && entities.grid?.display_zero_tolerance <= grid.state.fromGrid) {
      grid.state.fromGrid = 0;
    }

    // Update Color of Grid Production
    if (grid.color.toGrid !== undefined) {
      if (typeof grid.color.toGrid === 'object') {
        grid.color.toGrid = this.convertColorListToHex(grid.color.toGrid);
      }
      this.style.setProperty('--energy-grid-return-color', grid.color.toGrid || '#a280db');
    }

    // Update States Values of Grid Production
    if (grid.hasReturnToGrid) {
      grid.state.toGrid = this.getEntityStateWatthours(entities.grid?.entity.production);
    }

    // Reset Grid Production if it is below the tolerance
    if (entities.grid?.display_zero_tolerance !== undefined && entities.grid?.display_zero_tolerance <= (grid.state.toGrid ?? 0)) {
      grid.state.toGrid = 0;
    }

    // Update Icon of Grid depending on Power Outage and other user configurations (computeFieldIcon)
    grid.icon = !grid.powerOutage.isOutage
      ? this.computeFieldIcon(entities.grid, 'mdi:transmission-tower')
      : entities?.grid?.power_outage?.icon_alert || 'mdi:transmission-tower-off';

    // Update and Set Color of Grid Icon
    this.style.setProperty(
      '--icon-grid-color',
      grid.color.icon_type === 'consumption'
        ? 'var(--energy-grid-consumption-color)'
        : grid.color.icon_type === 'production'
        ? 'var(--energy-grid-return-color)'
        : grid.color.icon_type === true
        ? grid.state.fromGrid >= (grid.state.toGrid ?? 0)
          ? 'var(--energy-grid-consumption-color)'
          : 'var(--energy-grid-return-color)'
        : 'var(--primary-text-color)',
    );

    // Update and Set Color of Grid Name
    this.style.setProperty(
      '--secondary-text-grid-color',
      grid.secondary.color.type === 'consumption'
        ? 'var(--energy-grid-consumption-color)'
        : grid.secondary.color.type === 'production'
        ? 'var(--energy-grid-return-color)'
        : grid.secondary.color.type === true
        ? grid.state.fromGrid >= (grid.state.toGrid ?? 0)
          ? 'var(--energy-grid-consumption-color)'
          : 'var(--energy-grid-return-color)'
        : 'var(--primary-text-color)',
    );

    // Update and Set Color of Grid Circle
    this.style.setProperty(
      '--circle-grid-color',
      grid.color.circle_type === 'consumption'
        ? 'var(--energy-grid-consumption-color)'
        : grid.color.circle_type === 'production'
        ? 'var(--energy-grid-return-color)'
        : grid.color.circle_type === true
        ? grid.state.fromGrid >= (grid.state.toGrid ?? 0)
          ? 'var(--energy-grid-consumption-color)'
          : 'var(--energy-grid-return-color)'
        : 'var(--energy-grid-consumption-color)',
    );

    // Update States Values of Individuals
    individual1.state = individual1.has ? this.getEntityStateWatthours(entities.individual1?.entity) : 0;
    individual2.state = individual2.has ? this.getEntityStateWatthours(entities.individual2?.entity) : 0;

    // Update and Set Color of Individuals
    if (individual1.color !== undefined) {
      if (typeof individual1.color === 'object') individual1.color = this.convertColorListToHex(individual1.color);
      this.style.setProperty('--individualone-color', individual1.color); // dynamically update color of entity depending on user's input
    }
    if (individual2.color !== undefined) {
      if (typeof individual2.color === 'object') individual2.color = this.convertColorListToHex(individual2.color);
      this.style.setProperty('--individualtwo-color', individual2.color); // dynamically update color of entity depending on user's input
    }

    // Update and Set Color of Individuals Icon
    this.style.setProperty(
      '--icon-individualone-color',
      entities.individual1?.color_icon ? 'var(--individualone-color)' : 'var(--primary-text-color)',
    );
    this.style.setProperty(
      '--icon-individualtwo-color',
      entities.individual2?.color_icon ? 'var(--individualtwo-color)' : 'var(--primary-text-color)',
    );

    individual1.secondary.state = this.getSecondaryState(individual1.secondary, 'individual1Secondary');
    individual2.secondary.state = this.getSecondaryState(individual2.secondary, 'individual2Secondary');
    solar.secondary.state = this.getSecondaryState(solar.secondary, 'solarSecondary');
    home.secondary.state = this.getSecondaryState(home.secondary, 'homeSecondary');
    nonFossil.secondary.state = this.getSecondaryState(nonFossil.secondary, 'nonFossilSecondary');
    grid.secondary.state = this.getSecondaryState(grid.secondary, 'gridSecondary');

    // Update and Set Color of Solar
    if (entities.solar?.color !== undefined) {
      let solarColor = entities.solar?.color;
      if (typeof solarColor === 'object') solarColor = this.convertColorListToHex(solarColor);
      this.style.setProperty('--energy-solar-color', solarColor || '#ff9800');
    }
    this.style.setProperty('--icon-solar-color', entities.solar?.color_icon ? 'var(--energy-solar-color)' : 'var(--primary-text-color)');

    // Update State Values of Solar
    if (solar.has) {
      if (this.entityInverted('solar')) solar.state.total = Math.abs(Math.min(this.getEntityStateWatthours(entities.solar?.entity), 0));
      else solar.state.total = Math.max(this.getEntityStateWatthours(entities.solar?.entity), 0);
      if (entities.solar?.display_zero_tolerance) {
        if (entities.solar.display_zero_tolerance >= solar.state.total) solar.state.total = 0;
      }
    }

    // Update State Values of Battery
    if (battery.has) {
      battery.state.toBattery = this.getEntityStateWatthours(entities.battery?.entity?.production);
      battery.state.fromBattery = this.getEntityStateWatthours(entities.battery?.entity?.consumption);
    }

    // Reset Battery Values if Battery state is below tolerance
    if (entities?.battery?.display_zero_tolerance) {
      if (entities.battery.display_zero_tolerance >= battery.state.toBattery) battery.state.toBattery = 0;
      if (entities.battery.display_zero_tolerance >= battery.state.fromBattery) battery.state.fromBattery = 0;
    }

    // Update State Values of Solar going to Home
    if (solar.has) {
      solar.state.toHome = (solar.state.total ?? 0) - (grid.state.toGrid ?? 0) - (battery.state.toBattery ?? 0);
    }

    // Update State Values of Battery to Grid and Grid to Battery
    if (solar.state.toHome !== null && solar.state.toHome < 0) {
      // What we returned to the grid and what went in to the battery is more
      // than produced, so we have used grid energy to fill the battery or
      // returned battery energy to the grid
      if (battery.has) {
        grid.state.toBattery = Math.abs(solar.state.toHome);
        if (grid.state.toBattery > grid.state.fromGrid) {
          battery.state.toGrid = Math.min(grid.state.toBattery - grid.state.fromGrid, 0);
          grid.state.toBattery = grid.state.fromGrid;
        }
      }
      solar.state.toHome = 0;
    }

    // Update State Values of Solar to Battery and Battery to Grid
    if (solar.has && battery.has) {
      if (!battery.state.toGrid) {
        battery.state.toGrid = Math.max(
          0,
          (grid.state.toGrid || 0) - (solar.state.total || 0) - (battery.state.toBattery || 0) - (grid.state.toBattery || 0),
        );
      }
      solar.state.toBattery = battery.state.toBattery! - (grid.state.toBattery || 0);
    } else if (!solar.has && battery.has) {
      // In the absence of solar production, the battery is the only energy producer
      // besides the grid, so whatever was given to the grid must come from
      // the battery
      battery.state.toGrid = grid.state.toGrid ?? 0;

      // In the absence of solar production, what was consumed by the battery
      // must come from the grid, since there are no other energy producers.
      grid.state.toBattery = (battery.state.toBattery ?? 0);
    }

    // Update State Values of Solar to Grid
    if (solar.has && grid.state.toGrid) solar.state.toGrid = grid.state.toGrid - (battery.state.toGrid ?? 0);

    // Update State Values of Battery to Home
    if (battery.has) {
      battery.state.toHome = (battery.state.fromBattery ?? 0) - (battery.state.toGrid ?? 0);
    }

    // Update and Set Color of Battery Consumption
    if (battery.color.fromBattery !== undefined) {
      if (typeof battery.color.fromBattery === 'object') battery.color.fromBattery = this.convertColorListToHex(battery.color.fromBattery);
      this.style.setProperty('--energy-battery-out-color', battery.color.fromBattery || '#4db6ac');
    }

    // Update and Set Color of Battery Production
    if (battery.color.toBattery !== undefined) {
      if (typeof battery.color.toBattery === 'object') battery.color.toBattery = this.convertColorListToHex(battery.color.toBattery);
      this.style.setProperty('--energy-battery-in-color', battery.color.toBattery || '#a280db');
    }

    // Update and Set Color of Battery Icon
    this.style.setProperty(
      '--icon-battery-color',
      battery.color.icon_type === 'consumption'
        ? 'var(--energy-battery-in-color)'
        : battery.color.icon_type === 'production'
        ? 'var(--energy-battery-out-color)'
        : battery.color.icon_type === true
        ? battery.state.fromBattery >= battery.state.toBattery
          ? 'var(--energy-battery-out-color)'
          : 'var(--energy-battery-in-color)'
        : 'var(--primary-text-color)',
    );

    // Update and Set Color of Battery State of Charge
    this.style.setProperty(
      '--text-battery-state-of-charge-color',
      battery.color.state_of_charge_type === 'consumption'
        ? 'var(--energy-battery-in-color)'
        : battery.color.state_of_charge_type === 'production'
        ? 'var(--energy-battery-out-color)'
        : battery.color.state_of_charge_type === true
        ? battery.state.fromBattery >= battery.state.toBattery
          ? 'var(--energy-battery-out-color)'
          : 'var(--energy-battery-in-color)'
        : 'var(--primary-text-color)',
    );

    // Update and Set Color of Battery Circle
    this.style.setProperty(
      '--circle-battery-color',
      battery.color.circle_type === 'consumption'
        ? 'var(--energy-battery-in-color)'
        : battery.color.circle_type === 'production'
        ? 'var(--energy-battery-out-color)'
        : battery.color.circle_type === true
        ? battery.state.fromBattery >= battery.state.toBattery
          ? 'var(--energy-battery-out-color)'
          : 'var(--energy-battery-in-color)'
        : 'var(--energy-battery-in-color)',
    );

    // Calculate Sum of Both Individual Devices's State Values
    const totalIndividualConsumption = coerceNumber(individual1.state, 0) + coerceNumber(individual2.state, 0);

    // Calculate Sum of All Sources to get Total Home Consumption
    const totalHomeConsumption = Math.max(grid.state.fromGrid - (grid.state.toBattery ?? 0) + (solar.state.toHome ?? 0) + (battery.state.toHome ?? 0), 0);

    // Calculate Circumference of Semi-Circles
    let homeBatteryCircumference = 0;
    if (battery.state.toHome) homeBatteryCircumference = circleCircumference * (battery.state.toHome / totalHomeConsumption);

    let homeSolarCircumference = 0;
    if (solar.has) {
      homeSolarCircumference = circleCircumference * (solar.state.toHome! / totalHomeConsumption);
    }
    let homeGridCircumference: number | undefined;

    let lowCarbonEnergy: number | undefined;
    let nonFossilFuelenergy: number | undefined;
    let homeNonFossilCircumference: number | undefined;

    const totalLines =
      grid.state.fromGrid +
      (solar.state.toHome ?? 0) +
      (solar.state.toGrid ?? 0) +
      (solar.state.toBattery ?? 0) +
      (battery.state.toHome ?? 0) +
      (grid.state.toBattery ?? 0) +
      (battery.state.toGrid ?? 0);

    const batteryChargeState = entities?.battery?.state_of_charge ? this.getEntityState(entities.battery?.state_of_charge, true) : null;

    let batteryIcon = 'mdi:battery-high';
    if (batteryChargeState === null) {
      batteryIcon = 'mdi:battery-high';
    } else if (batteryChargeState <= 72 && batteryChargeState > 44) {
      batteryIcon = 'mdi:battery-medium';
    } else if (batteryChargeState <= 44 && batteryChargeState > 16) {
      batteryIcon = 'mdi:battery-low';
    } else if (batteryChargeState <= 16) {
      batteryIcon = 'mdi:battery-outline';
    }
    if (entities.battery?.icon !== undefined) batteryIcon = entities.battery?.icon;

    const newDur = {
      batteryGrid: this.circleRate(grid.state.toBattery ?? battery.state.toGrid ?? 0, totalLines),
      batteryToHome: this.circleRate(battery.state.toHome ?? 0, totalLines),
      gridToHome: this.circleRate(grid.state.fromGrid, totalLines),
      solarToBattery: this.circleRate(solar.state.toBattery ?? 0, totalLines),
      solarToGrid: this.circleRate(solar.state.toGrid ?? 0, totalLines),
      solarToHome: this.circleRate(solar.state.toHome ?? 0, totalLines),
      individual1: this.circleRate(individual1.state ?? 0, totalIndividualConsumption),
      individual2: this.circleRate(individual2.state ?? 0, totalIndividualConsumption),
      nonFossil: this.circleRate(nonFossilFuelenergy ?? 0, totalLines),
    };

    ['batteryGrid', 'batteryToHome', 'gridToHome', 'solar.state.toBattery', 'solar.state.toGrid', 'solarToHome'].forEach(flowName => {
      const flowSVGElement = this[`${flowName}Flow`] as SVGSVGElement;
      if (flowSVGElement && this.previousDur[flowName] && this.previousDur[flowName] !== newDur[flowName]) {
        flowSVGElement.pauseAnimations();
        flowSVGElement.setCurrentTime(flowSVGElement.getCurrentTime() * (newDur[flowName] / this.previousDur[flowName]));
        flowSVGElement.unpauseAnimations();
      }
      this.previousDur[flowName] = newDur[flowName];
    });

    let nonFossilColor = entities.fossil_fuel_percentage?.color;
    if (nonFossilColor !== undefined) {
      if (typeof nonFossilColor === 'object') nonFossilColor = this.convertColorListToHex(nonFossilColor);
      this.style.setProperty('--non-fossil-color', nonFossilColor || 'var(--energy-non-fossil-color)');
    }
    this.style.setProperty(
      '--icon-non-fossil-color',
      entities.fossil_fuel_percentage?.color_icon ? 'var(--non-fossil-color)' : 'var(--primary-text-color)' || 'var(--non-fossil-color)',
    );

    const homeIconColorType = entities.home?.color_icon;
    const homeSources = {
      battery: {
        value: homeBatteryCircumference,
        color: 'var(--energy-battery-out-color)',
      },
      solar: {
        value: homeSolarCircumference,
        color: 'var(--energy-solar-color)',
      },
      grid: {
        value: homeGridCircumference,
        color: 'var(--energy-grid-consumption-color)',
      },
      gridNonFossil: {
        value: homeNonFossilCircumference,
        color: 'var(--energy-non-fossil-color)',
      },
    };

    /* return source object with largest value property */
    const homeLargestSource = Object.keys(homeSources).reduce((a, b) => (homeSources[a].value > homeSources[b].value ? a : b));

    let iconHomeColor = 'var(--primary-text-color)';
    if (homeIconColorType === 'solar') {
      iconHomeColor = 'var(--energy-solar-color)';
    } else if (homeIconColorType === 'battery') {
      iconHomeColor = 'var(--energy-battery-out-color)';
    } else if (homeIconColorType === 'grid') {
      iconHomeColor = 'var(--energy-grid-consumption-color)';
    } else if (homeIconColorType === true) {
      iconHomeColor = homeSources[homeLargestSource].color;
    }
    this.style.setProperty('--icon-home-color', iconHomeColor);

    const homeTextColorType = entities.home?.color_value;
    let textHomeColor = 'var(--primary-text-color)';
    if (homeTextColorType === 'solar') {
      textHomeColor = 'var(--energy-solar-color)';
    } else if (homeTextColorType === 'battery') {
      textHomeColor = 'var(--energy-battery-out-color)';
    } else if (homeTextColorType === 'grid') {
      textHomeColor = 'var(--energy-grid-consumption-color)';
    } else if (homeTextColorType === true) {
      textHomeColor = homeSources[homeLargestSource].color;
    }

    const solarIcon =
      entities.solar?.icon || (entities.solar?.use_metadata && this.getEntityStateObj(solar.mainEntity)?.attributes?.icon) || 'mdi:solar-power';

    const solarName: string =
      entities.solar?.name ||
      (entities.solar?.use_metadata && this.getEntityStateObj(solar.mainEntity)?.attributes.friendly_name) ||
      this.hass.localize('ui.panel.lovelace.cards.energy.energy_distribution.solar');

    const homeIcon = entities.home?.icon || (entities.home?.use_metadata && this.getEntityStateObj(home.mainEntity)?.attributes?.icon) || 'mdi:home';

    const homeName =
      entities.home?.name ||
      (entities.home?.use_metadata && this.getEntityStateObj(home.mainEntity)?.attributes.friendly_name) ||
      this.hass.localize('ui.panel.lovelace.cards.energy.energy_distribution.home');

    const nonFossilIcon =
      entities.fossil_fuel_percentage?.icon ||
      (entities.fossil_fuel_percentage?.use_metadata && this.getEntityStateObj(entities.fossil_fuel_percentage.entity)?.attributes?.icon) ||
      'mdi:leaf';

    const nonFossilName =
      entities.fossil_fuel_percentage?.name ||
      (entities.fossil_fuel_percentage?.use_metadata && this.getEntityStateObj(entities.fossil_fuel_percentage.entity)?.attributes.friendly_name) ||
      this.hass.localize('ui.panel.lovelace.cards.energy.energy_distribution.low_carbon');

    const individual1DisplayState = this.displayValue(
      individual1.state,
      entities.individual1?.unit_of_measurement,
      undefined,
      entities.individual1?.decimals,
    );

    const individual2DisplayState = this.displayValue(
      individual2.state,
      entities.individual2?.unit_of_measurement,
      undefined,
      entities.individual2?.decimals,
    );

    this.style.setProperty('--text-home-color', textHomeColor);

    this.style.setProperty('--text-solar-color', entities.solar?.color_value ? 'var(--energy-solar-color)' : 'var(--primary-text-color)');
    this.style.setProperty(
      '--text-non-fossil-color',
      entities.fossil_fuel_percentage?.color_value ? 'var(--non-fossil-color)' : 'var(--primary-text-color)',
    );
    this.style.setProperty(
      '--secondary-text-non-fossil-color',
      entities.fossil_fuel_percentage?.secondary_info?.color_value ? 'var(--non-fossil-color)' : 'var(--primary-text-color)',
    );

    this.style.setProperty(
      '--text-individualone-color',
      entities.individual1?.color_value ? 'var(--individualone-color)' : 'var(--primary-text-color)',
    );
    this.style.setProperty(
      '--text-individualtwo-color',
      entities.individual2?.color_value ? 'var(--individualtwo-color)' : 'var(--primary-text-color)',
    );

    this.style.setProperty(
      '--secondary-text-individualone-color',
      entities.individual1?.secondary_info?.color_value ? 'var(--individualone-color)' : 'var(--primary-text-color)',
    );
    this.style.setProperty(
      '--secondary-text-individualtwo-color',
      entities.individual2?.secondary_info?.color_value ? 'var(--individualtwo-color)' : 'var(--primary-text-color)',
    );

    this.style.setProperty(
      '--secondary-text-solar-color',
      entities.solar?.secondary_info?.color_value ? 'var(--energy-solar-color)' : 'var(--primary-text-color)',
    );

    this.style.setProperty(
      '--secondary-text-home-color',
      entities.home?.secondary_info?.color_value ? 'var(--text-home-color)' : 'var(--primary-text-color)',
    );

    const homeUsageToDisplay =
      entities.home?.override_state && entities.home.entity
        ? entities.home?.subtract_individual
          ? this.displayValue(this.getEntityStateWatthours(entities.home.entity) - totalIndividualConsumption)
          : this.displayValue(this.getEntityStateWatthours(entities.home.entity))
        : entities.home?.subtract_individual
        ? this.displayValue(totalHomeConsumption - totalIndividualConsumption || 0)
        : this.displayValue(totalHomeConsumption);

    let lowCarbonPercentage: number | undefined;
    if (this._data && this._data.co2SignalEntity && this._data.fossilEnergyConsumption) {
      // Calculate high carbon consumption
      const highCarbonEnergy = Object.values(this._data.fossilEnergyConsumption).reduce((sum, a) => sum + a, 0) * 1000;

      if (highCarbonEnergy !== null) {
        lowCarbonEnergy = grid.state.fromGrid - highCarbonEnergy;
      }

      const highCarbonConsumption = highCarbonEnergy * (grid.state.fromGrid / grid.state.fromGrid);

      homeGridCircumference = circleCircumference * (highCarbonConsumption / totalHomeConsumption);
      homeNonFossilCircumference = circleCircumference - (homeSolarCircumference || 0) - (homeBatteryCircumference || 0) - homeGridCircumference;
      lowCarbonPercentage = ((lowCarbonEnergy || 0) / grid.state.fromGrid) * 100;
    }

    const hasNonFossilFuelUsage =
      lowCarbonEnergy !== null && lowCarbonEnergy && lowCarbonEnergy > ((entities.fossil_fuel_percentage?.display_zero_tolerance ?? 0) * 1000 || 0);

    const hasFossilFuelPercentage = entities.fossil_fuel_percentage?.show === true;

    if (this._config.energy_date_selection === false) {
      lowCarbonPercentage = 100 - this.getEntityState(entities.fossil_fuel_percentage?.entity, true);
      lowCarbonEnergy = (lowCarbonPercentage * grid.state.fromGrid) / 100;
    }

    // Adjust Curved Lines

    const isCardWideEnough = this._width > 420;
    if (solar.has) {
      if (battery.has) {
        // has solar, battery and grid
        this.style.setProperty('--lines-svg-not-flat-line-height', isCardWideEnough ? '106%' : '102%');
        this.style.setProperty('--lines-svg-not-flat-line-top', isCardWideEnough ? '-3%' : '-1%');
        this.style.setProperty('--lines-svg-flat-width', isCardWideEnough ? 'calc(100% - 160px)' : 'calc(100% - 160px)');
      } else {
        // has solar but no battery
        this.style.setProperty('--lines-svg-not-flat-line-height', isCardWideEnough ? '104%' : '102%');
        this.style.setProperty('--lines-svg-not-flat-line-top', isCardWideEnough ? '-2%' : '-1%');
        this.style.setProperty('--lines-svg-flat-width', isCardWideEnough ? 'calc(100% - 154px)' : 'calc(100% - 157px)');
        this.style.setProperty('--lines-svg-not-flat-width', isCardWideEnough ? 'calc(103% - 172px)' : 'calc(103% - 169px)');
      }
    }

    const baseSecondarySpan = ({
      className,
      template,
      value,
      entityId,
      icon,
    }: {
      className: string;
      template?: string;
      value?: string;
      entityId?: string;
      icon?: string;
    }) => {
      if (value || template) {
        return html`<span
          class="secondary-info ${className}"
          @click=${(e: { stopPropagation: () => void }) => {
            this.openDetails(e, entityId);
          }}
          @keyDown=${(e: { key: string; stopPropagation: () => void }) => {
            if (e.key === 'Enter') {
              this.openDetails(e, entityId);
            }
          }}
        >
          ${entities.solar?.secondary_info?.icon ? html`<ha-icon class="secondary-info small" .icon=${icon}></ha-icon>` : ''}
          ${template ?? value}</span
        >`;
      }
      return '';
    };

    const generalSecondarySpan = (field, key: string) => {
      return html` ${field.secondary.has || field.secondary.template
        ? html` ${baseSecondarySpan({
            className: key,
            entityId: field.secondary.entity,
            icon: field.secondary.icon,
            value: this.displayValue(field.secondary.state, field.secondary.unit, field.secondary.unit_white_space, field?.secondary?.decimals),
          })}`
        : ''}`;
    };

    const individualSecondarySpan = (individual: Individual, key: string) => {
      const value = individual.secondary.has
        ? this.displayValue(individual.secondary.state, individual.secondary.unit, individual.secondary.unit_white_space)
        : undefined;
      const passesDisplayZeroCheck =
        individual.secondary.displayZero !== false ||
        (isNumberValue(individual.secondary.state)
          ? (Number(individual.secondary.state) ?? 0) > (individual.secondary.displayZeroTolerance ?? 0)
          : true);
      return html` ${individual.secondary.has && passesDisplayZeroCheck
        ? html`${baseSecondarySpan({
            className: key,
            entityId: individual.secondary.entity,
            icon: individual.secondary.icon,
            value,
          })}`
        : ''}`;
    };

    return html`
      <ha-card .header=${this._config.title}>
        <div class="card-content" id="energy-flow-card-plus">
          ${solar.has || individual2.has || individual1.has || hasFossilFuelPercentage
            ? html`<div class="row">
                ${!hasFossilFuelPercentage || (!hasNonFossilFuelUsage && entities.fossil_fuel_percentage?.display_zero === false)
                  ? html`<div class="spacer"></div>`
                  : html`<div class="circle-container low-carbon">
                      <span class="label">${nonFossilName}</span>
                      <div
                        class="circle"
                        @click=${(e: { stopPropagation: () => void }) => {
                          this.openDetails(e, entities.fossil_fuel_percentage?.entity);
                        }}
                        @keyDown=${(e: { key: string; stopPropagation: () => void }) => {
                          if (e.key === 'Enter') {
                            this.openDetails(e, entities.fossil_fuel_percentage?.entity);
                          }
                        }}
                      >
                        ${generalSecondarySpan(nonFossil, 'nonFossilFuel')}
                        <ha-icon
                          .icon=${nonFossilIcon}
                          class="low-carbon"
                          style="${nonFossil.secondary.has ? 'padding-top: 2px;' : 'padding-top: 0px;'}
                          ${entities.fossil_fuel_percentage?.display_zero_state !== false ||
                          (nonFossilFuelenergy || 0) > (entities.fossil_fuel_percentage?.display_zero_tolerance || 0)
                            ? 'padding-bottom: 2px;'
                            : 'padding-bottom: 0px;'}"
                        ></ha-icon>
                        ${entities.fossil_fuel_percentage?.display_zero_state !== false || hasNonFossilFuelUsage !== false
                          ? html`
                              <span class="low-carbon"
                                >${this.displayValue(
                                  entities.fossil_fuel_percentage?.state_type === 'percentage' ? lowCarbonPercentage || 0 : lowCarbonEnergy || 0,
                                  entities.fossil_fuel_percentage?.state_type === 'percentage' ? '%' : undefined,
                                  entities.fossil_fuel_percentage?.unit_white_space,
                                  entities.fossil_fuel_percentage?.decimals,
                                )}</span
                              >
                            `
                          : ''}
                      </div>
                      ${this.showLine(nonFossilFuelenergy || 0)
                        ? html`
                            <svg width="80" height="30">
                              <path d="M40 -10 v40" class="low-carbon" id="low-carbon" />
                              ${hasNonFossilFuelUsage
                                ? svg`<circle
                              r="2.4"
                              class="low-carbon"
                              vector-effect="non-scaling-stroke"
                            >
                                <animateMotion
                                  dur="${this.additionalCircleRate(entities.fossil_fuel_percentage?.calculate_flow_rate, newDur.nonFossil) || 0}s"
                                  repeatCount="indefinite"
                                  calcMode="linear"
                                >
                                  <mpath xlink:href="#low-carbon" />
                                </animateMotion>
                            </circle>`
                                : ''}
                            </svg>
                          `
                        : ''}
                    </div>`}
                ${solar.has
                  ? html`<div class="circle-container solar">
                      <span class="label">${solarName}</span>
                      <div
                        class="circle"
                        @click=${(e: { stopPropagation: () => void }) => {
                          this.openDetails(e, solar.mainEntity);
                        }}
                        @keyDown=${(e: { key: string; stopPropagation: () => void }) => {
                          if (e.key === 'Enter') {
                            this.openDetails(e, solar.mainEntity);
                          }
                        }}
                      >
                        ${generalSecondarySpan(solar, 'solar')}
                        <ha-icon
                          id="solar-icon"
                          .icon=${solarIcon}
                          style="${solar.secondary.has ? 'padding-top: 2px;' : 'padding-top: 0px;'}
                          ${entities.solar?.display_zero_state !== false || (solar.state.total || 0) > 0
                            ? 'padding-bottom: 2px;'
                            : 'padding-bottom: 0px;'}"
                        ></ha-icon>
                        ${entities.solar?.display_zero_state !== false || (solar.state.total || 0) > 0
                          ? html` <span class="solar"> ${this.displayValue(solar.state.total)}</span>`
                          : ''}
                      </div>
                    </div>`
                  : individual2.has || individual1.has
                  ? html`<div class="spacer"></div>`
                  : ''}
                ${individual2.has
                  ? html`<div class="circle-container individual2">
                      <span class="label">${individual2.name}</span>
                      <div
                        class="circle"
                        @click=${(e: { stopPropagation: () => void }) => {
                          this.openDetails(e, individual2.mainEntity);
                        }}
                        @keyDown=${(e: { key: string; stopPropagation: () => void }) => {
                          if (e.key === 'Enter') {
                            this.openDetails(e, individual2.mainEntity);
                          }
                        }}
                      >
                        ${individualSecondarySpan(individual2, 'individual2')}
                        <ha-icon
                          id="individual2-icon"
                          .icon=${individual2.icon}
                          style="${individual2.secondary.has ? 'padding-top: 2px;' : 'padding-top: 0px;'}
                          ${entities.individual2?.display_zero_state !== false || (individual2.state || 0) > 0
                            ? 'padding-bottom: 2px;'
                            : 'padding-bottom: 0px;'}"
                        ></ha-icon>
                        ${entities.individual2?.display_zero_state !== false || (individual2.state || 0) > 0
                          ? html` <span class="individual2">${individual2DisplayState} </span>`
                          : ''}
                      </div>
                      ${this.showLine(individual2.state || 0)
                        ? html`
                            <svg width="80" height="30">
                              <path d="M40 -10 v50" id="individual2" />
                              ${individual2.state
                                ? svg`<circle
                              r="2.4"
                              class="individual2"
                              vector-effect="non-scaling-stroke"
                            >
                              <animateMotion
                                dur="${this.additionalCircleRate(entities.individual2?.calculate_flow_rate, newDur.individual2)}s"    
                                repeatCount="indefinite"
                                calcMode="linear"
                                keyPoints=${entities.individual2?.inverted_animation ? '0;1' : '1;0'}
                                keyTimes="0;1"
                              >
                                <mpath xlink:href="#individual2" />
                              </animateMotion>
                            </circle>`
                                : ''}
                            </svg>
                          `
                        : ''}
                    </div>`
                  : individual1.has
                  ? html`<div class="circle-container individual1">
                      <span class="label">${individual1.name}</span>
                      <div
                        class="circle"
                        @click=${(e: { stopPropagation: () => void }) => {
                          e.stopPropagation();
                          this.openDetails(e, individual1.mainEntity);
                        }}
                        @keyDown=${(e: { key: string; stopPropagation: () => void }) => {
                          if (e.key === 'Enter') {
                            this.openDetails(e, individual1.mainEntity);
                          }
                        }}
                      >
                        ${individualSecondarySpan(individual1, 'individual1')}
                        <ha-icon
                          id="individual1-icon"
                          .icon=${individual1.icon}
                          style="${individual1.secondary.has ? 'padding-top: 2px;' : 'padding-top: 0px;'}
                          ${entities.individual1?.display_zero_state !== false || (individual1.state || 0) > 0
                            ? 'padding-bottom: 2px;'
                            : 'padding-bottom: 0px;'}"
                        ></ha-icon>
                        ${entities.individual1?.display_zero_state !== false || (individual1.state || 0) > 0
                          ? html` <span class="individual1">${individual1DisplayState} </span>`
                          : ''}
                      </div>
                      ${this.showLine(individual1.state || 0)
                        ? html`
                            <svg width="80" height="30">
                              <path d="M40 -10 v40" id="individual1" />
                              ${individual1.state
                                ? svg`<circle
                                r="2.4"
                                class="individual1"
                                vector-effect="non-scaling-stroke"
                              >
                                <animateMotion
                                  dur="${this.additionalCircleRate(entities.individual1?.calculate_flow_rate, newDur.individual1)}s"
                                  repeatCount="indefinite"
                                  calcMode="linear"
                                  keyPoints=${entities.individual1?.inverted_animation ? '0;1' : '1;0'}
                                  keyTimes="0;1"

                                >
                                  <mpath xlink:href="#individual1" />
                                </animateMotion>
                              </circle>`
                                : ''}
                            </svg>
                          `
                        : html``}
                    </div> `
                  : html`<div class="spacer"></div>`}
              </div>`
            : html``}
          <div class="row">
            ${grid.has
              ? html` <div class="circle-container grid">
                  <div
                    class="circle"
                    @click=${(e: { stopPropagation: () => void }) => {
                      this.openDetails(e, grid.mainEntity);
                    }}
                    @keyDown=${(e: { key: string; stopPropagation: () => void }) => {
                      if (e.key === 'Enter') {
                        this.openDetails(e, grid.mainEntity);
                      }
                    }}
                  >
                    ${generalSecondarySpan(grid, 'grid')}
                    <ha-icon .icon=${grid.icon}></ha-icon>
                    ${(entities.grid?.display_state === 'two_way' ||
                      entities.grid?.display_state === undefined ||
                      (entities.grid?.display_state === 'one_way' && (grid.state.toGrid ?? 0) > 0) ||
                      (entities.grid?.display_state === 'one_way_no_zero' &&
                        (grid.state.fromGrid === null || grid.state.fromGrid === 0) &&
                        grid.state.toGrid !== 0)) &&
                    grid.state.toGrid !== null &&
                    !grid.powerOutage.isOutage
                      ? html`<span
                          class="return"
                          @click=${(e: { stopPropagation: () => void }) => {
                            const target = Array.isArray(entities.grid!.entity.production)
                              ? entities?.grid?.entity?.production[0]
                              : entities?.grid?.entity.production;
                            this.openDetails(e, target);
                          }}
                          @keyDown=${(e: { key: string; stopPropagation: () => void }) => {
                            if (e.key === 'Enter') {
                              const target = Array.isArray(entities.grid!.entity.production)
                                ? entities?.grid?.entity?.production[0]
                                : entities?.grid?.entity.production;
                              this.openDetails(e, target);
                            }
                          }}
                        >
                          <ha-icon class="small" .icon=${'mdi:arrow-left'}></ha-icon>
                          ${this.displayValue(grid.state.toGrid)}
                        </span>`
                      : null}
                    ${(entities.grid?.display_state === 'two_way' ||
                      entities.grid?.display_state === undefined ||
                      (entities.grid?.display_state === 'one_way' && grid.state.fromGrid > 0) ||
                      (entities.grid?.display_state === 'one_way_no_zero' && (grid.state.toGrid === null || grid.state.toGrid === 0))) &&
                    grid.state.fromGrid !== null &&
                    !grid.powerOutage.isOutage
                      ? html` <span class="consumption">
                          <ha-icon class="small" .icon=${'mdi:arrow-right'}></ha-icon>${this.displayValue(grid.state.fromGrid)}
                        </span>`
                      : ''}
                    ${grid.powerOutage.isOutage
                      ? html`<span class="grid power-outage"> ${entities.grid?.power_outage?.label_alert || html`Power<br />Outage`} </span>`
                      : ''}
                  </div>
                  <span class="label">${grid.name}</span>
                </div>`
              : html`<div class="spacer"></div>`}
            <div class="circle-container home">
              <div
                class="circle"
                id="home-circle"
                @click=${(e: { stopPropagation: () => void }) => {
                  this.openDetails(e, home.mainEntity);
                }}
                @keyDown=${(e: { key: string; stopPropagation: () => void }) => {
                  if (e.key === 'Enter') {
                    this.openDetails(e, home.mainEntity);
                  }
                }}
              >
                ${generalSecondarySpan(home, 'home')}
                <ha-icon .icon=${homeIcon}></ha-icon>
                ${homeUsageToDisplay}
                <svg class="home-circle-sections">
                  ${homeSolarCircumference !== undefined
                    ? svg`<circle
                            class="solar"
                            cx="40"
                            cy="40"
                            r="38"
                            stroke-dasharray="${homeSolarCircumference} ${circleCircumference - homeSolarCircumference}"
                            shape-rendering="geometricPrecision"
                            stroke-dashoffset="-${circleCircumference - homeSolarCircumference}"
                          />`
                    : ''}
                  ${homeBatteryCircumference
                    ? svg`<circle
                            class="battery"
                            cx="40"
                            cy="40"
                            r="38"
                            stroke-dasharray="${homeBatteryCircumference} ${circleCircumference - homeBatteryCircumference}"
                            stroke-dashoffset="-${circleCircumference - homeBatteryCircumference - (homeSolarCircumference || 0)}"
                            shape-rendering="geometricPrecision"
                          />`
                    : ''}
                  ${homeNonFossilCircumference !== undefined
                    ? svg`<circle
                            class="low-carbon"
                            cx="40"
                            cy="40"
                            r="38"
                            stroke-dasharray="${homeNonFossilCircumference} ${circleCircumference - homeNonFossilCircumference}"
                            stroke-dashoffset="-${
                              circleCircumference - homeNonFossilCircumference - (homeBatteryCircumference || 0) - (homeSolarCircumference || 0)
                            }"
                            shape-rendering="geometricPrecision"
                          />`
                    : ''}
                  <circle
                    class="grid"
                    cx="40"
                    cy="40"
                    r="38"
                    stroke-dasharray="${homeGridCircumference ??
                    circleCircumference - homeSolarCircumference! - (homeBatteryCircumference || 0)} ${homeGridCircumference !== undefined
                      ? circleCircumference - homeGridCircumference
                      : homeSolarCircumference! + (homeBatteryCircumference || 0)}"
                    stroke-dashoffset="0"
                    shape-rendering="geometricPrecision"
                  />
                </svg>
              </div>
              ${this.showLine(individual1.state || 0) && individual2.has ? '' : html` <span class="label">${homeName}</span>`}
            </div>
          </div>
          ${battery.has || (individual1.has && individual2.has)
            ? html`<div class="row">
                <div class="spacer"></div>
                ${battery.has
                  ? html` <div class="circle-container battery">
                      <div
                        class="circle"
                        @click=${(e: { stopPropagation: () => void }) => {
                          const target = entities.battery?.state_of_charge
                            ? entities.battery?.state_of_charge
                            : typeof entities.battery?.entity === 'string'
                            ? entities.battery?.entity
                            : entities.battery?.entity!.production;
                          e.stopPropagation();
                          this.openDetails(e, target);
                        }}
                        @keyDown=${(e: { key: string; stopPropagation: () => void }) => {
                          if (e.key === 'Enter') {
                            const target = entities.battery?.state_of_charge
                              ? entities.battery?.state_of_charge
                              : typeof entities.battery!.entity === 'string'
                              ? entities.battery!.entity!
                              : entities.battery!.entity!.production;
                            e.stopPropagation();
                            this.openDetails(e, target);
                          }
                        }}
                      >
                        ${batteryChargeState !== null
                          ? html` <span
                              @click=${(e: { stopPropagation: () => void }) => {
                                e.stopPropagation();
                                this.openDetails(e, entities.battery?.state_of_charge);
                              }}
                              @keyDown=${(e: { key: string; stopPropagation: () => void }) => {
                                if (e.key === 'Enter') {
                                  e.stopPropagation();
                                  this.openDetails(e, entities.battery?.state_of_charge);
                                }
                              }}
                              id="battery-state-of-charge-text"
                            >
                              ${this.displayValue(
                                batteryChargeState,
                                entities?.battery?.state_of_charge_unit || '%',
                                entities?.battery?.state_of_charge_unit_white_space,
                                entities?.battery?.state_of_charge_decimals || 0,
                              )}
                            </span>`
                          : null}
                        <ha-icon
                          .icon=${batteryIcon}
                          style=${entities.battery?.display_state === 'two_way'
                            ? 'padding-top: 0px; padding-bottom: 2px;'
                            : entities.battery?.display_state === 'one_way' && battery.state.toBattery === 0 && battery.state.fromBattery === 0
                            ? 'padding-top: 2px; padding-bottom: 0px;'
                            : 'padding-top: 2px; padding-bottom: 2px;'}
                          @click=${(e: { stopPropagation: () => void }) => {
                            e.stopPropagation();
                            this.openDetails(e, entities.battery?.state_of_charge);
                          }}
                          @keyDown=${(e: { key: string; stopPropagation: () => void }) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation();
                              this.openDetails(e, entities.battery?.state_of_charge);
                            }
                          }}
                        ></ha-icon>
                        ${entities.battery?.display_state === 'two_way' ||
                        entities.battery?.display_state === undefined ||
                        (entities.battery?.display_state === 'one_way' && battery.state.toBattery > 0) ||
                        (entities.battery?.display_state === 'one_way_no_zero' && battery.state.toBattery !== 0)
                          ? html`<span
                              class="battery-in"
                              @click=${(e: { stopPropagation: () => void }) => {
                                const target =
                                  typeof entities.battery!.entity === 'string' ? entities.battery!.entity! : entities.battery!.entity!.production!;
                                e.stopPropagation();
                                this.openDetails(e, target);
                              }}
                              @keyDown=${(e: { key: string; stopPropagation: () => void }) => {
                                if (e.key === 'Enter') {
                                  const target =
                                    typeof entities.battery!.entity === 'string' ? entities.battery!.entity! : entities.battery!.entity!.production!;
                                  e.stopPropagation();
                                  this.openDetails(e, target);
                                }
                              }}
                            >
                              <ha-icon class="small" .icon=${'mdi:arrow-down'}></ha-icon>
                              ${this.displayValue(battery.state.toBattery)}</span
                            >`
                          : ''}
                        ${entities.battery?.display_state === 'two_way' ||
                        entities.battery?.display_state === undefined ||
                        (entities.battery?.display_state === 'one_way' && battery.state.fromBattery > 0) ||
                        (entities.battery?.display_state === 'one_way_no_zero' && (battery.state.toBattery === 0 || battery.state.fromBattery !== 0))
                          ? html`<span
                              class="battery-out"
                              @click=${(e: { stopPropagation: () => void }) => {
                                const target =
                                  typeof entities.battery!.entity === 'string' ? entities.battery!.entity! : entities.battery!.entity!.consumption!;
                                e.stopPropagation();
                                this.openDetails(e, target);
                              }}
                              @keyDown=${(e: { key: string; stopPropagation: () => void }) => {
                                if (e.key === 'Enter') {
                                  const target =
                                    typeof entities.battery!.entity === 'string' ? entities.battery!.entity! : entities.battery!.entity!.consumption!;
                                  e.stopPropagation();
                                  this.openDetails(e, target);
                                }
                              }}
                            >
                              <ha-icon class="small" .icon=${'mdi:arrow-up'}></ha-icon>
                              ${this.displayValue(battery.state.fromBattery)}</span
                            >`
                          : ''}
                      </div>
                      <span class="label">${battery.name}</span>
                    </div>`
                  : html`<div class="spacer"></div>`}
                ${individual2.has && individual1.has
                  ? html`<div class="circle-container individual1 bottom">
                      ${this.showLine(individual1.state || 0)
                        ? html`
                            <svg width="80" height="30">
                              <path d="M40 40 v-40" id="individual1" />
                              ${individual1.state
                                ? svg`<circle
                                r="2.4"
                                class="individual1"
                                vector-effect="non-scaling-stroke"
                              >
                                <animateMotion
                                  dur="${this.additionalCircleRate(entities.individual1?.calculate_flow_rate, newDur.individual1)}s"
                                  repeatCount="indefinite"
                                  calcMode="linear"
                                  keyPoints=${entities.individual1?.inverted_animation ? '0;1' : '1;0'}
                                  keyTimes="0;1"
                                >
                                  <mpath xlink:href="#individual1" />
                                </animateMotion>
                              </circle>`
                                : ''}
                            </svg>
                          `
                        : html` <svg width="80" height="30"></svg> `}
                      <div
                        class="circle"
                        @click=${(e: { stopPropagation: () => void }) => {
                          this.openDetails(e, individual1.mainEntity);
                        }}
                        @keyDown=${(e: { key: string; stopPropagation: () => void }) => {
                          if (e.key === 'Enter') {
                            this.openDetails(e, individual1.mainEntity);
                          }
                        }}
                      >
                        ${individualSecondarySpan(individual1, 'individual1')}
                        <ha-icon
                          id="individual1-icon"
                          .icon=${individual1.icon}
                          style="${individual1.secondary.has ? 'padding-top: 2px;' : 'padding-top: 0px;'}
                          ${entities.individual1?.display_zero_state !== false || (individual1.state || 0) > 0
                            ? 'padding-bottom: 2px;'
                            : 'padding-bottom: 0px;'}"
                        ></ha-icon>
                        ${entities.individual1?.display_zero_state !== false || (individual1.state || 0) > 0
                          ? html` <span class="individual1">${individual1DisplayState} </span>`
                          : ''}
                      </div>
                      <span class="label">${individual1.name}</span>
                    </div>`
                  : html`<div class="spacer"></div>`}
              </div>`
            : html`<div class="spacer"></div>`}
          ${solar.has && this.showLine(solar.state.toHome || 0)
            ? html`<div
                class="lines ${classMap({
                  high: battery.has,
                  'individual1-individual2': !battery.has && individual2.has && individual1.has,
                })}"
              >
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" id="solar-home-flow">
                  <path
                    id="solar"
                    class="solar"
                    d="M${battery.has ? 55 : 53},0 v${grid.has ? 15 : 17} c0,${battery.has ? '30 10,30 30,30' : '35 10,35 30,35'} h25"
                    vector-effect="non-scaling-stroke"
                  ></path>
                  ${solar.state.toHome
                    ? svg`<circle
                            r="1"
                            class="solar"
                            vector-effect="non-scaling-stroke"
                          >
                            <animateMotion
                              dur="${newDur.solarToHome}s"
                              repeatCount="indefinite"
                              calcMode="linear"
                            >
                              <mpath xlink:href="#solar" />
                            </animateMotion>
                          </circle>`
                    : ''}
                </svg>
              </div>`
            : ''}
          ${grid.hasReturnToGrid && solar.has && this.showLine(solar.state.toGrid ?? 0)
            ? html`<div
                class="lines ${classMap({
                  high: battery.has,
                  'individual1-individual2': !battery.has && individual2.has && individual1.has,
                })}"
              >
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" id="solar-grid-flow">
                  <path
                    id="return"
                    class="return"
                    d="M${battery.has ? 45 : 47},0 v15 c0,${battery.has ? '30 -10,30 -30,30' : '35 -10,35 -30,35'} h-20"
                    vector-effect="non-scaling-stroke"
                  ></path>
                  ${solar.state.toGrid && solar.has
                    ? svg`<circle
                        r="1"
                        class="return"
                        vector-effect="non-scaling-stroke"
                      >
                        <animateMotion
                          dur="${newDur.solarToGrid}s"
                          repeatCount="indefinite"
                          calcMode="linear"
                        >
                          <mpath xlink:href="#return" />
                        </animateMotion>
                      </circle>`
                    : ''}
                </svg>
              </div>`
            : ''}
          ${battery.has && solar.has && this.showLine(solar.state.toBattery || 0)
            ? html`<div
                class="lines ${classMap({
                  high: battery.has,
                  'individual1-individual2': !battery.has && individual2.has && individual1.has,
                })}"
              >
                <svg
                  viewBox="0 0 100 100"
                  xmlns="http://www.w3.org/2000/svg"
                  preserveAspectRatio="xMidYMid slice"
                  id="solar-battery-flow"
                  class="flat-line"
                >
                  <path id="battery-solar" class="battery-solar" d="M50,0 V100" vector-effect="non-scaling-stroke"></path>
                  ${solar.state.toBattery
                    ? svg`<circle
                            r="1"
                            class="battery-solar"
                            vector-effect="non-scaling-stroke"
                          >
                            <animateMotion
                              dur="${newDur.solarToBattery}s"
                              repeatCount="indefinite"
                              calcMode="linear"
                            >
                              <mpath xlink:href="#battery-solar" />
                            </animateMotion>
                          </circle>`
                    : ''}
                </svg>
              </div>`
            : ''}
          ${grid.has && this.showLine(grid.state.fromGrid)
            ? html`<div
                class="lines ${classMap({
                  high: battery.has,
                  'individual1-individual2': !battery.has && individual2.has && individual1.has,
                })}"
              >
                <svg
                  viewBox="0 0 100 100"
                  xmlns="http://www.w3.org/2000/svg"
                  preserveAspectRatio="xMidYMid slice"
                  id="grid-home-flow"
                  class="flat-line"
                >
                  <path class="grid" id="grid" d="M0,${battery.has ? 50 : solar.has ? 56 : 53} H100" vector-effect="non-scaling-stroke"></path>
                  ${grid.state.fromGrid
                    ? svg`<circle
                    r="1"
                    class="grid"
                    vector-effect="non-scaling-stroke"
                  >
                    <animateMotion
                      dur="${newDur.gridToHome}s"
                      repeatCount="indefinite"
                      calcMode="linear"
                    >
                      <mpath xlink:href="#grid" />
                    </animateMotion>
                  </circle>`
                    : ''}
                </svg>
              </div>`
            : null}
          ${battery.has && this.showLine(battery.state.toHome)
            ? html`<div
                class="lines ${classMap({
                  high: battery.has,
                  'individual1-individual2': !battery.has && individual2.has && individual1.has,
                })}"
              >
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" id="battery-home-flow">
                  <path
                    id="battery-home"
                    class="battery-home"
                    d="M55,100 v-${grid.has ? 15 : 17} c0,-30 10,-30 30,-30 h20"
                    vector-effect="non-scaling-stroke"
                  ></path>
                  ${battery.state.toHome
                    ? svg`<circle
                        r="1"
                        class="battery-home"
                        vector-effect="non-scaling-stroke"
                      >
                        <animateMotion
                          dur="${newDur.batteryToHome}s"
                          repeatCount="indefinite"
                          calcMode="linear"
                        >
                          <mpath xlink:href="#battery-home" />
                        </animateMotion>
                      </circle>`
                    : ''}
                </svg>
              </div>`
            : ''}
          ${grid.has && battery.has && this.showLine(Math.max(grid.state.toBattery || 0, battery.state.toGrid || 0))
            ? html`<div
                class="lines ${classMap({
                  high: battery.has,
                  'individual1-individual2': !battery.has && individual2.has && individual1.has,
                })}"
              >
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" id="battery-grid-flow">
                  <path
                    id="battery-grid"
                    class=${classMap({
                      'battery-from-grid': Boolean(grid.state.toBattery),
                      'battery-to-grid': Boolean(battery.state.toGrid),
                    })}
                    d="M45,100 v-15 c0,-30 -10,-30 -30,-30 h-20"
                    vector-effect="non-scaling-stroke"
                  ></path>
                  ${grid.state.toBattery
                    ? svg`<circle
                    r="1"
                    class="battery-from-grid"
                    vector-effect="non-scaling-stroke"
                  >
                    <animateMotion
                      dur="${newDur.batteryGrid}s"
                      repeatCount="indefinite"
                      keyPoints="1;0" keyTimes="0;1"
                      calcMode="linear"
                    >
                      <mpath xlink:href="#battery-grid" />
                    </animateMotion>
                  </circle>`
                    : ''}
                  ${battery.state.toGrid
                    ? svg`<circle
                        r="1"
                        class="battery-to-grid"
                        vector-effect="non-scaling-stroke"
                      >
                        <animateMotion
                          dur="${newDur.batteryGrid}s"
                          repeatCount="indefinite"
                          calcMode="linear"
                        >
                          <mpath xlink:href="#battery-grid" />
                        </animateMotion>
                      </circle>`
                    : ''}
                </svg>
              </div>`
            : ''}
        </div>
        ${this._config.dashboard_link
          ? html`
              <div class="card-actions">
                <a href=${this._config.dashboard_link}
                  ><mwc-button>
                    ${this._config.dashboard_link_label ||
                    this.hass.localize('ui.panel.lovelace.cards.energy.energy_distribution.go_to_energy_dashboard')}
                  </mwc-button></a
                >
              </div>
            `
          : ''}
      </ha-card>
    `;
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    if (!this._config || !this.hass) {
      return;
    }

    const elem = this?.shadowRoot?.querySelector('#energy-flow-card-plus');
    const widthStr = elem ? getComputedStyle(elem).getPropertyValue('width') : '0px';
    this._width = parseInt(widthStr.replace('px', ''), 10);
  }

  static styles = styles;
}
