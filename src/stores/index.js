import axios from "axios";
import { defineStore } from "pinia";
import { TRIBALDEX_API } from "../config";
import { emitter } from "../plugins/mitt";
import { sidechain } from "../plugins/sidechain";
import { useUserStore } from "./user";

const parseJSON = (json) => {
  let result = {};

  try {
    result = JSON.parse(json);
  } catch {
    //
  }

  return result;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const useStore = defineStore({
  id: "main",

  state: () => ({
    settings: null,
    hivePrice: 0,
  }),

  actions: {
    async requestKeychain(fn, ...args) {
      return new Promise((resolve) => {
        window.hive_keychain[fn](...args, (r) => {
          if (r.error === "user_cancel") {
            return resolve({ success: false, cancel: true, ...r });
          }

          if (r.success) {
            return resolve({ success: true, ...r });
          }

          return resolve({ success: false, ...r });
        });
      });
    },

    async requestBrodcastTransfer({ to, amount, currency, memo, eventName }) {
      emitter.emit("broadcast-awaiting");

      const useStore = useUserStore();

      const { success, result } = await this.requestKeychain(
        "requestTransfer",
        useStore.username,
        to,
        amount,
        memo,
        currency
      );

      if (success) {
        if (!result.id) {
          result.id = result.tx_id;
        }

        if (eventName) {
          emitter.emit(eventName, result);
        } else {
          emitter.emit("broadcast-success", result);
        }
      }

      emitter.emit("broadcast-done");
    },

    async requestBroadcastJson({ key = "Active", id, message, json, eventName = null }) {
      emitter.emit("broadcast-awaiting");

      const useStore = useUserStore();

      const { success, result } = await this.requestKeychain(
        "requestCustomJson",
        useStore.username,
        id || this.settings.sidechain_id,
        key,
        JSON.stringify(json),
        message
      );

      if (success) {
        if (!result.id) {
          result.id = result.tx_id;
        }

        const nTrx = json.length;

        const data = { ...result, ntrx: nTrx };

        if (eventName) {
          emitter.emit(eventName, data);
        } else {
          emitter.emit("broadcast-success", data);
        }
      }

      emitter.emit("broadcast-done");
    },

    async fetchSettings() {
      try {
        const { data } = await axios.get(`${TRIBALDEX_API}/settings`);

        this.settings = data;
      } catch {
        //
      }
    },

    async fetchHivePrice() {
      try {
        const { data } = await axios.get("https://prices.splinterlands.com/prices");

        this.hivePrice = data.hive;
      } catch {
        //
      }
    },

    async validateTransaction(trxId, maxCount = 5) {
      let error = false;
      let trx = null;
      let count = 0;

      do {
        try {
          await sleep(10000);

          trx = await sidechain.getTransaction(trxId);
        } catch (e) {
          console.log(e);
        }

        count += 1;
      } while (!trx && count < maxCount);

      if (trx) {
        const logs = parseJSON(trx.logs);

        if (logs.errors) {
          error = true;
        }
      }

      emitter.emit("transaction-validated", {
        trx_id: trxId,
        contract: trx ? trx.contract : null,
        action: trx ? trx.action : null,
        payload: trx ? parseJSON(trx.payload) : null,
        error,
      });
    },
  },
});
