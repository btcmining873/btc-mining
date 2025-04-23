"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import InAppBrowserWarning from "./components/InAppBrowserWarning";
import MobileOptimizationInfo from "./components/MobileOptimizationInfo";
import { db } from "./firebase";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";

export default function Home() {
  const [walletAmount, setWalletAmount] = useState(0);
  const [isMining, setIsMining] = useState(false);
  const [isMiningPaused, setIsMiningPaused] = useState(false);
  const [deviceId, setDeviceId] = useState("");

  // Cihaz ID'si oluştur veya al
  useEffect(() => {
    const getOrCreateDeviceId = () => {
      let id = localStorage.getItem("deviceId");
      if (!id) {
        id =
          "device_" +
          Date.now() +
          "_" +
          Math.random().toString(36).substring(2);
        localStorage.setItem("deviceId", id);
      }
      return id;
    };

    const id = getOrCreateDeviceId();
    setDeviceId(id);
  }, []);

  // Firebase'den veri almak ve realtime güncellemeleri dinlemek için
  useEffect(() => {
    if (!deviceId) return;

    const minerRef = doc(db, "miners", deviceId);

    // İlk veri kontrolü
    const checkInitialData = async () => {
      const docSnap = await getDoc(minerRef);

      if (!docSnap.exists()) {
        // Yeni kullanıcı, ilk kaydı oluştur
        await setDoc(minerRef, {
          balance: 0,
          isMining: false,
          isMiningPaused: false,
          lastUpdateTime: Date.now(),
          createdAt: Date.now(),
          lastActive: Date.now(),
        });
      } else {
        // Mevcut kullanıcının başlangıçta aktif olduğunu bildir
        await updateDoc(minerRef, {
          lastActive: Date.now(),
        });
      }
    };

    checkInitialData();

    // Kullanıcı sayfayı yenilediğinde bile veri kaybı olmaması için,
    // tarayıcı kapanırken veya sayfa yenilenirken Firebase'e son durumu kaydet
    const handleBeforeUnload = () => {
      // Burada doğrudan updateDoc kullanamayız çünkü beforeunload sırasında
      // asenkron işlemler güvenilir çalışmaz, o yüzden sendelBeacon kullanılabilir
      // ancak basitlik için şimdilik düzenli otomatik güncellemelerle çözeceğiz
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Realtime güncellemeleri dinle
    const unsubscribe = onSnapshot(minerRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setWalletAmount(data.balance || 0);
        setIsMining(data.isMining || false);
        setIsMiningPaused(data.isMiningPaused || false);
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [deviceId]);

  // Kullanıcı aktivitesini takip et
  useEffect(() => {
    if (!deviceId) return;

    const handleActivity = () => {
      updateDoc(doc(db, "miners", deviceId), {
        lastActive: Date.now(),
      });
    };

    // Sayfa görünürlüğü değiştiğinde Firebase'i bilgilendir
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && deviceId) {
        updateDoc(doc(db, "miners", deviceId), {
          lastActive: Date.now(),
        });
      }
    };

    // Etkinlik dinleyicileri ekle
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    window.addEventListener("scroll", handleActivity);
    window.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [deviceId]);

  // Mining durumunu ve bakiyeyi periyodik olarak kontrol edip güncelle
  useEffect(() => {
    if (!deviceId || !isMining || isMiningPaused) return;

    const checkAndUpdateMiningProgress = async () => {
      const minerRef = doc(db, "miners", deviceId);
      const docSnap = await getDoc(minerRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentTime = Date.now();
        const lastUpdateTime = data.lastUpdateTime;
        const FOUR_HOURS = 4 * 60 * 60 * 1000; // 4 saat
        const timeElapsed = currentTime - lastUpdateTime;
        const intervalsElapsed = Math.floor(timeElapsed / FOUR_HOURS);

        // Her 4 saatte bir bakiyeyi güncelle
        if (intervalsElapsed > 0 && data.isMining && !data.isMiningPaused) {
          // 1 periyot (4 saat) için 11.52 coin ekle (Firebase fonksiyonuyla aynı değer)
          const INCREMENT = 11.52;
          const additionalBalance = intervalsElapsed * INCREMENT;

          // Bakiyeyi güncelle
          await updateDoc(minerRef, {
            balance: data.balance + additionalBalance,
            lastUpdateTime: lastUpdateTime + intervalsElapsed * FOUR_HOURS,
            lastActive: currentTime,
          });
        }
      }
    };

    // İlk çağrı
    checkAndUpdateMiningProgress();

    // Her 30 saniyede bir kontrol et (daha sık kontrol ederek tutarsızlıkları azaltalım)
    const intervalId = setInterval(checkAndUpdateMiningProgress, 30000);

    return () => clearInterval(intervalId);
  }, [deviceId, isMining, isMiningPaused]);

  const startMining = async () => {
    if (!deviceId) return;

    const minerRef = doc(db, "miners", deviceId);
    await updateDoc(minerRef, {
      isMining: true,
      isMiningPaused: false,
      lastUpdateTime: Date.now(),
      lastActive: Date.now(),
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <InAppBrowserWarning />
      <MobileOptimizationInfo />
      <div className="flex flex-col md:flex-row items-center justify-between gap-12">
        <div className="md:w-1/2">
          <motion.h1
            className="text-4xl md:text-6xl font-bold mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Dijital Para Biriminin Geleceğine Hoş Geldiniz
          </motion.h1>
          <motion.p
            className="text-lg mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Yenilikçi platformumuzla bugün mining yapmaya ve coin kazanmaya
            başlayın.
          </motion.p>
          <motion.div
            className="bg-black text-white p-6 rounded-lg shadow-md mb-8"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6, duration: 0.3 }}
          >
            <h2 className="text-2xl font-semibold mb-2">Bakiyeniz</h2>
            <motion.p
              className="text-3xl font-bold text-yellow-400"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{
                duration: 0.3,
                times: [0, 0.5, 1],
                repeat: walletAmount % 11.52 < 0.01 ? 5 : 0,
              }}
            >
              ${walletAmount.toLocaleString()}
            </motion.p>
          </motion.div>
          {!isMining ? (
            <motion.button
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-6 rounded-full text-lg transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startMining}
            >
              Mining Yapmaya Başla
            </motion.button>
          ) : isMiningPaused ? (
            <div className="bg-red-500 text-white font-bold py-3 px-6 rounded-full text-lg inline-block">
              Mining Duraklatıldı
            </div>
          ) : (
            <div className="bg-green-500 text-white font-bold py-3 px-6 rounded-full text-lg inline-block">
              Mining Aktif
            </div>
          )}
        </div>
        <div className="md:w-1/2 flex justify-center">
          <motion.div
            initial={{ opacity: 0, rotate: -10 }}
            animate={{ opacity: 1, rotate: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            {/* Mining animation - using a placeholder that simulates animation */}
            <div className="relative w-80 h-80">
              <motion.div
                className="absolute inset-0 bg-yellow-300 rounded-full opacity-70"
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.7, 0.9, 0.7],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  ease: "easeInOut",
                }}
              />
              <motion.div
                className="absolute inset-8 bg-yellow-400 rounded-full flex items-center justify-center"
                animate={{
                  rotate: 360,
                }}
                transition={{
                  repeat: Infinity,
                  duration: 8,
                  ease: "linear",
                }}
              >
                <span className="text-4xl font-bold">₿</span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
