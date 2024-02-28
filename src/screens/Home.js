import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, Alert, Modal } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { randomBytes, Mnemonic, Wallet, JsonRpcProvider, formatUnits } from 'ethers';
import * as ethers from 'ethers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Events from "@pioneer-platform/pioneer-events";
import axios from "axios";
let QUERY_KEY = 'tester-mm-mobile-driverasdasdas'
const apiClient = axios.create({
    baseURL: spec, // Your base URL
    headers: {
        'Authorization':  QUERY_KEY// Replace 'YOUR_AUTH_TOKEN' with your actual token
    }
});
// let spec = "https://cash2btc.com/spec/swagger.json"
let spec = "https://cash2btc.com/api/v1"
let PIONEER_WS = 'wss://cash2btc.com'
let USDT_CONTRACT_POLYGON = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f"
const service = "https://polygon.rpc.blxrbdn.com"

export default function Home({ navigation, GlobalState }) {
    const { } = GlobalState;
    const [mnemonic, setMnemonic] = useState('');
    const [address, setAddress] = useState('');
    const [balance, setBalance] = useState('');
    const [location, setLocation] = useState(null);
    const [isOnline, setIsOnline] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [countdown, setCountdown] = useState(30); // 30 seconds for the countdown timer

    const acceptDelivery = () => {
        // Handle delivery acceptance logic here
        setShowModal(false);
    };

    const declineDelivery = () => {
        // Handle delivery decline logic here
        setShowModal(false);
    };

    let startSocket = async function(){
        try{
            console.log("go online! ")

            //sub to events
            clientEvents.events.on('message', async (event) => {
                let tag = TAG + " | events | "
                try{
                    console.log('event:',event)
                    //is online
                    //TODO push location

                    //if match
                    if(event.payload && event.payload.type == "match"){
                        //handle match
                        console.log(tag,"event: ",event)
                    }



                }catch(e){
                    console.error(e)
                }
            })

        }catch(e){
            console.error(e)
        }
    }

    let onStart = async function(){
        try{
            console.log("onStart")
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission to access location was denied');
                return;
            }
            let location = await Location.getCurrentPositionAsync({});
            setLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
            });

            //
            let storedMnemonic = await AsyncStorage.getItem('mnemonic');
            if(storedMnemonic){
                setMnemonic(storedMnemonic);
            } else {
                const randomEntropyBytes = ethers.randomBytes(16); // 128-bit entropy
                console.log("randomEntropyBytes: ", randomEntropyBytes);
                // console.log("newMnemonic: ", Mnemonic.fromEntropy(randomEntropyBytes))
                let newMnemonic = Mnemonic.fromEntropy(randomEntropyBytes);
                AsyncStorage.setItem('mnemonic', newMnemonic.phrase);
                storedMnemonic = newMnemonic.phrase
                setMnemonic(storedMnemonic)
            }
            // Create wallet from the mnemonic
            // console.log("ethers: ", ethers);
            const wallet = Wallet.fromPhrase(storedMnemonic);
            console.log("Wallet address: ", wallet.address);
            setAddress(wallet.address);

            //get balance
            // The ABI for the methods we want to interact with
            const minABI = [
                // balanceOf
                {
                    "constant":true,
                    "inputs":[{"name":"_owner","type":"address"}],
                    "name":"balanceOf",
                    "outputs":[{"name":"balance","type":"uint256"}],
                    "type":"function"
                },
                // decimals
                {
                    "constant":true,
                    "inputs":[],
                    "name":"decimals",
                    "outputs":[{"name":"","type":"uint8"}],
                    "type":"function"
                }
            ];
            // Assuming a provider is set up (e.g., ethers.getDefaultProvider or other)
            const provider = new JsonRpcProvider(service);

            // Create a new instance of a Contract
            const newContract = new ethers.Contract(USDT_CONTRACT_POLYGON, minABI, provider);

            // Now using ethers to call contract methods
            const decimals = await newContract.decimals();
            const balanceBN = await newContract.balanceOf(wallet.address);

            // Since ethers.js returns BigNumber, you need to format it considering the token's decimals
            // Use the formatUnits utility function to convert the balance to a human-readable format
            const tokenBalance = formatUnits(balanceBN, decimals);

            // Convert balanceBN from a BigNumber to a number, considering the decimals
            // const tokenBalance = balanceBN.div(ethers.BigNumber.from(10).pow(decimals)).toNumber();
            console.log("tokenBalance: ", tokenBalance);
            setBalance(tokenBalance)

            let GLOBAL_SESSION = new Date().getTime()
            let config = {
                queryKey:QUERY_KEY, //TODO make this generated
                username:"driver:"+wallet.address,
                wss:PIONEER_WS
            }
            console.log("config: ", config);
            const statusLocal = await axios.get(
                spec+ "/bankless/info"
            );
            console.log("statusLocal: ", statusLocal.data);

            //sub ALL events
            let clientEvents = new Events.Events(config)
            clientEvents.init()
            clientEvents.setUsername(config.username)

            let driver = {
                pubkey:address,
                driverId:"driver:"+address,
                location:[ 4.5981, -74.0758 ]
            }

            //get terminal info
            let driverInfo = await apiClient.get(spec+ "/bankless/driver/private/"+driver.driverId);
            console.log("driverInfo: ", driverInfo.data);

            if(driverInfo.data){
                console.log("driver: ",driver)
                // let updateDriver = await apiClient.post(
                //     spec+"/bankless/driver/update",
                //     driver
                // );
                // console.log("updateDriver: ",updateDriver)
            }else{
                let newDriver = await apiClient.post(
                    spec+"/bankless/driver/submit",
                    driver
                );
                console.log("newDriver: ",newDriver)
            }

            //on events
            console.log("sub to events")


        }catch(e){
            console.error(e)
        }
    }

    useEffect(() => {
        onStart()
    }, []);

    const goToLiquidityPage = () => {
        navigation.navigate('Liquidity');
    }

    const toggleOnlineStatus = () => {
        setIsOnline(!isOnline);
        if (!isOnline) {
            // Code to start WebSocket connection
            startSocket();
        } else {
            // Code to close WebSocket connection
            // Assuming clientEvents is your WebSocket client
        }
    };

    return (
        <View style={styles.screen}>
            <Modal visible={showModal} animationType="slide">
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text>Do you want to accept this delivery?</Text>
                    <Text>{countdown} seconds left</Text>
                    <TouchableOpacity onPress={() => acceptDelivery()}>
                        <Text>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => declineDelivery()}>
                        <Text>Decline</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
            <Header />
            <View style={styles.body}>
                <TouchableOpacity
                    style={styles.button}
                >
                    <Text>address: {address}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.button, isOnline ? styles.online : styles.offline]}
                    onPress={toggleOnlineStatus}>
                    <Text>{isOnline ? '(currently looking for orders) Go Offline' : '(currently not looking for order) Go Online'}</Text>
                </TouchableOpacity>
                <Text>status online: {isOnline.toString()}</Text>
            </View>
            <View style={styles.body}>
                <MapView style={styles.map} initialRegion={location}>
                    {location && <Marker coordinate={location} title="You are here" description="Your location" />}
                </MapView>
            </View>
            <Footer navigation={navigation} />
        </View>
    )
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center'
    },
    body: {
        flex: 8,
        width: '100%',
        backgroundColor: '#14141410'
    },
    task: {
        backgroundColor: 'white',
        padding: 10,
        margin: 10,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
    },
    online: {
        backgroundColor: '#1ccb1b', // Green color for online
        shadowColor: "#29d522",
    },
    offline: {
        backgroundColor: '#ff6347', // Red color for offline
        shadowColor: "#ff6347",
    },
    button: {
        alignItems: 'center',
        backgroundColor: '#1ccb1b',
        padding: 15,
        paddingTop: 10,
        paddingBottom: 10,
        margin: 10,
        marginBottom: 30,
        borderRadius: 12,
        shadowColor: "#29d522",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
    },
    buttonText: {
        color: 'white',
        fontWeight: '900'
    },
    map: {
        width: '100%',
        height: '80%',
    }
})
