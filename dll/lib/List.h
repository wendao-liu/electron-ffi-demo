//
// Created by Noah Wimmer on 3/23/21.
//

#include <stdio.h>
#include <stdlib.h>

#ifndef LIST_LIST_H
#define LIST_LIST_H

typedef struct node {
    void* data;
    struct node* next;
} Node;

typedef struct {
    Node* head;
    int size;
} List;

List* initList(void);

int getSize(List* list);

void freeList(List* list);

void* getAtIndex(List* list, int index);

Node* getNodeAtIndex(List* list, int index);

int insertAtHead(List* list, void* o);

int insertAtTail(List* list, void* o);

int listContains(List* list, void* o);

void* removeNodeAtIndex(List* list, int index);

int insertAfter(List* list, void* o, void* sentinel);

#endif //LIST_LIST_H
