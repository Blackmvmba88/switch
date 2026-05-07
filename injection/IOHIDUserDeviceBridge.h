#ifndef IOHIDUserDeviceBridge_h
#define IOHIDUserDeviceBridge_h

#include <IOKit/hid/IOHIDLib.h>
#include <IOKit/hidsystem/IOHIDUserDevice.h>

// Helper to create the device
IOHIDUserDeviceRef createVirtualHIDDevice(CFDictionaryRef properties);

// Helper to send report
IOReturn sendHIDReport(IOHIDUserDeviceRef device, const uint8_t *report, CFIndex reportLength);

#endif
