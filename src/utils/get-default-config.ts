import { HomeAssistant } from 'custom-card-helpers';
import { EnergyFlowCardPlusConfig } from '../energy-flow-card-plus-config';

export const defaultValues = {
  maxFlowRate: 6,
  minFlowRate: 1,
  watthourDecimals: 1,
  kilowatthourDecimals: 0,
  minExpectedEnergy: 10,
  maxExpectedEnergy: 2000,
  whkWhThreshold: 1000,
};

export function getDefaultConfig(hass: HomeAssistant): EnergyFlowCardPlusConfig {
  function checkStrings(entiyId: string, testStrings: string[]): boolean {
    const friendlyName = hass.states[entiyId].attributes.friendly_name;
    return testStrings.some(str => entiyId.includes(str) || friendlyName?.includes(str));
  }
  const powerEntities = Object.keys(hass.states).filter(entityId => {
    const stateObj = hass.states[entityId];
    const isAvailable =
      (stateObj.state && stateObj.attributes && stateObj.attributes.device_class === 'energy') || stateObj.entity_id.includes('energy');
    return isAvailable;
  });

  const gridEnergyTestString = ['grid', 'utility', 'net', 'meter'];
  const solarTests = ['solar', 'pv', 'photovoltaic', 'inverter'];
  const batteryTests = ['battery'];
  const batteryEnergyEntities = powerEntities.filter(entityId => checkStrings(entityId, batteryTests));
  const gridEnergyEntities = powerEntities.filter(entityId => checkStrings(entityId, gridEnergyTestString));
  const firstSolarEnergyEntity = powerEntities.filter(entityId => checkStrings(entityId, solarTests))[0];

  return {
    type: 'custom:energy-flow-card-plus',
    entities: {
      battery: {
        entity: {
          consumption: batteryEnergyEntities[0] ?? '',
          production: batteryEnergyEntities[1] ?? '',
        },
      },
      grid: {
        entity: {
          consumption: gridEnergyEntities[0] ?? '',
          production: gridEnergyEntities[1] ?? '',
        },
      },
      solar: firstSolarEnergyEntity ? { entity: firstSolarEnergyEntity, display_zero_state: true } : undefined,
    },
    clickable_entities: true,
    display_zero_lines: true,
    use_new_flow_rate_model: true,
    energy_date_selection: true,
    wh_decimals: defaultValues.watthourDecimals,
    kwh_decimals: defaultValues.kilowatthourDecimals,
    min_flow_rate: defaultValues.minFlowRate,
    max_flow_rate: defaultValues.maxFlowRate,
    max_expected_energy: defaultValues.maxExpectedEnergy,
    min_expected_energy: defaultValues.minExpectedEnergy,
    wh_kwh_threshold: defaultValues.whkWhThreshold,
  };
}
