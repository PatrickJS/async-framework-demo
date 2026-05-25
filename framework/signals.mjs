let activeEffect = null;

const toSerializable = (value) => {
  if (Array.isArray(value)) {
    return value.map(toSerializable);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !key.startsWith('__'))
        .map(([key, entryValue]) => [key, toSerializable(entryValue)]),
    );
  }

  return value;
};

export const createSignal = (initialValue, metadata = {}) => {
  let current = initialValue;
  const subscribers = new Set();
  const signal = {
    id: metadata.id,
    name: metadata.name ?? metadata.id,
    source: metadata.source,

    get value() {
      if (activeEffect) {
        activeEffect.reads.add(signal.id);
        subscribers.add(activeEffect);
      }

      return current;
    },

    set value(nextValue) {
      current = nextValue;

      for (const effect of subscribers) {
        effect.run();
      }
    },

    snapshot() {
      return {
        id: signal.id,
        name: signal.name,
        source: signal.source,
        value: toSerializable(current),
      };
    },
  };

  return signal;
};

export const createEffect = (name, fn) => {
  const effect = {
    name,
    reads: new Set(),
    runs: 0,
    value: undefined,

    run() {
      const previous = activeEffect;
      activeEffect = effect;
      effect.reads.clear();

      try {
        effect.value = fn();
        effect.runs += 1;
        return effect.value;
      } finally {
        activeEffect = previous;
      }
    },

    snapshot() {
      return {
        name: effect.name,
        reads: [...effect.reads],
        runs: effect.runs,
        value: toSerializable(effect.value),
      };
    },
  };

  effect.run();
  return effect;
};

export const serializeSignalGraph = ({ signals, effects }) => {
  return {
    signals: Object.fromEntries(
      Object.entries(signals).map(([name, signal]) => [name, signal.snapshot()]),
    ),
    effects: effects.map((effect) => effect.snapshot()),
  };
};
