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
// let spec = "https://cash2btc.com/spec/swagger.json"
let spec = "https://cash2btc.com/api/v1"
let PIONEER_WS = 'wss://cash2btc.com'
let USDT_CONTRACT_POLYGON = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f"
const service = "https://polygon.rpc.blxrbdn.com"
import { v4 as uuidv4 } from 'uuid';


export default function Home({ navigation, GlobalState }) {
    const { } = GlobalState;
    const [isLoading, setIsLoading] = useState(false);
    const [mnemonic, setMnemonic] = useState('');
    const [address, setAddress] = useState('');
    const [username, setUsername] = useState('');
    const [balance, setBalance] = useState('');
    const [config, setConfig] = useState(null);
    const [location, setLocation] = useState(null);
    const [isOnline, setIsOnline] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [events, setEvents] = useState(null);
    const [api, setClient] = useState(null);
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
            console.log("username: ",username)
            let clientEvents = new Events.Events(config)
            setEvents(clientEvents)
            clientEvents.init()
            clientEvents.setUsername(username)

            //sub to events
            clientEvents.events.on('message', async (event) => {
                try{
                    event = JSON.parse(event)
                    console.log('event:',event)
                    console.log('event:',event.type)
                    //is online
                    //TODO push location

                    //if match
                    if(event && event.type == "match"){
                        console.log("MATCH EVENT!: ")
                        //handle match
                        // console.log("event: ",event)
                        setShowModal(true)
                    }

                }catch(e){
                    console.error(e)
                }
            })
        }catch(e){
            console.error(e)
        }
    }

    let stopSocket = async function(){
        try{
            console.log("go online! ")
            if(events) events.disconnect()
        }catch(e){
            console.error(e)
        }
    }

    let onStart = async function(){
        try{
            console.log("onStart")
            let QUERY_KEY = await AsyncStorage.getItem('QUERY_KEY');
            if(!QUERY_KEY){
                QUERY_KEY = uuidv4()
                AsyncStorage.setItem('QUERY_KEY',QUERY_KEY);
            }
            const apiClient = axios.create({
                baseURL: spec, // Your base URL
                headers: {
                    'Authorization':  QUERY_KEY// Replace 'YOUR_AUTH_TOKEN' with your actual token
                }
            });
            setClient(apiClient)


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

            let config = {
                queryKey:QUERY_KEY, //TODO make this generated
                username:"driver:"+wallet.address,
                wss:PIONEER_WS
            }
            setConfig(config)
            setUsername("driver:"+wallet.address)
            console.log("config: ", config);
            const statusLocal = await axios.get(
                spec+ "/bankless/info"
            );
            console.log("statusLocal: ", statusLocal.data);


            let driver = {
                pubkey:address,
                driverId:"driver:"+address,
                location:[ 4.5981, -74.0758 ]
            }

            //get terminal info
            let driverInfo = await apiClient.get(spec+ "/bankless/driver/private/"+driver.driverId);
            console.log("driverInfo: ", driverInfo.data);

            if(driverInfo.data.driverInfo){
                console.log("Driver found! Update!")
                let updateDriver = await apiClient.post(
                    spec+"/bankless/driver/update",
                    driver
                );
                console.log("updateDriver: ",updateDriver.data)
            }else{
                console.log("New Driver!")
                let newDriver = await apiClient.post(
                    spec+"/bankless/driver/submit",
                    driver
                );
                console.log("newDriver: ",newDriver.data)
            }

            //on events
            // console.log("sub to events")
            // let clientEvents = new Events.Events(config)
            // setEvents(clientEvents)
            // clientEvents.init()
            // clientEvents.setUsername(username)
            //
            // //sub to events
            // clientEvents.events.on('message', async (event) => {
            //     try{
            //         console.log('event:',event)
            //         //is online
            //         //TODO push location
            //
            //         //if match
            //         if(event.payload && event.payload.type == "match"){
            //             //handle match
            //             console.log("event: ",event)
            //             setShowModal(true)
            //         }
            //
            //     }catch(e){
            //         console.error(e)
            //     }
            // })
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
            console.log("Starting Socket!")
            // Code to start WebSocket connection
            startSocket();
        } else {
            console.log("Stopping Socket!")
            stopSocket()
            // Code to close WebSocket connection
            // Assuming clientEvents is your WebSocket client
        }
    };

    return (
        <View style={styles.screen}>
            <Modal visible={showModal} animationType="slide" transparent={true}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalView}>
                        {isLoading ? (
                            <ActivityIndicator size="large" color="#0000ff" />
                        ) : (
                            <>
                                <Text>Do you want to accept this delivery?</Text>
                                <Text>{countdown} seconds left</Text>
                                <TouchableOpacity style={styles.largeButton} onPress={() => acceptDelivery()}>
                                    <Text style={styles.buttonText}>Accept</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.largeButton} onPress={() => declineDelivery()}>
                                    <Text style={styles.buttonText}>Decline</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
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

                <TouchableOpacity
                    style={styles.button}
                    onPress={() => setShowModal(true)}>
                    <Text>Open Modal</Text>
                </TouchableOpacity>
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
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
    },
    modalView: {
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    largeButton: {
        backgroundColor: '#1ccb1b',
        padding: 20, // Increase padding for larger buttons
        marginVertical: 10, // Add vertical margin
        width: 200, // Set a fixed width for the button
        borderRadius: 20, // Rounded corners for the button
        alignItems: 'center',
        shadowColor: '#29d522',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
    },
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
